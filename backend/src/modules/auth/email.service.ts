import { BadRequestException, ConflictException, Injectable, ServiceUnavailableException } from '@nestjs/common';
import { EmailTokenKind } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { MailService } from '../../common/mail.service';
import { PrismaService } from '../../common/prisma.service';

const sha = (s: string) => createHash('sha256').update(s).digest('hex');
const VERIFY_HOURS = 24;
const RESET_MINUTES = 30;
const web = () => (process.env.WEB_ORIGIN ?? 'http://localhost:3000').split(',')[0];

/** 이메일 인증 · 이메일로 비밀번호 재설정 (인증한 주소로만) */
@Injectable()
export class EmailService {
  constructor(private prisma: PrismaService, private mail: MailService) {}

  private ready() {
    if (!this.mail.enabled()) throw new ServiceUnavailableException({ message: '이 서버에는 메일 발송 설정이 아직 없어요', code: 'MAIL_DISABLED' });
  }

  private async token(userId: string, kind: EmailTokenKind, email: string, ms: number) {
    const raw = randomBytes(32).toString('base64url');
    // 같은 종류의 이전 링크는 쓸 수 없게
    await this.prisma.emailToken.updateMany({ where: { userId, kind, usedAt: null }, data: { usedAt: new Date() } });
    await this.prisma.emailToken.create({ data: { userId, kind, email, tokenHash: sha(raw), expiresAt: new Date(Date.now() + ms) } });
    return raw;
  }

  /** 이메일 등록 · 바꾸기: 인증 메일을 보낸다. 인증 전까지 재설정에는 쓰지 않는다. */
  async requestVerify(userId: string, emailIn: string) {
    this.ready();
    const email = emailIn.trim().toLowerCase();
    const taken = await this.prisma.user.findFirst({ where: { email, emailVerifiedAt: { not: null }, NOT: { id: userId } }, select: { id: true } });
    if (taken) throw new ConflictException('이미 다른 계정에서 인증한 이메일이에요');
    const raw = await this.token(userId, EmailTokenKind.VERIFY, email, VERIFY_HOURS * 3600_000);
    await this.mail.send({
      to: email,
      subject: '[말랑말랑] 이메일 인증',
      text: `아래 링크를 누르면 이메일 인증이 끝나요. (${VERIFY_HOURS}시간 동안만 쓸 수 있어요)\n\n${web()}/verify-email?token=${raw}\n\n직접 요청하지 않았다면 이 메일은 무시해 주세요.`,
    });
    return { sent: true, email };
  }

  async verify(raw: string) {
    const t = await this.prisma.emailToken.findUnique({ where: { tokenHash: sha(raw) } });
    if (!t || t.kind !== EmailTokenKind.VERIFY || t.usedAt || t.expiresAt < new Date()) throw new BadRequestException({ message: '링크가 만료됐거나 이미 썼어요. 설정에서 다시 보내 주세요', code: 'BAD_TOKEN' });
    const taken = await this.prisma.user.findFirst({ where: { email: t.email, NOT: { id: t.userId } }, select: { id: true, emailVerifiedAt: true } });
    if (taken?.emailVerifiedAt) throw new ConflictException('이미 다른 계정에서 인증한 이메일이에요');
    await this.prisma.$transaction([
      // 인증하지 않은 채 같은 주소를 적어 둔 다른 계정이 있으면 비운다
      ...(taken ? [this.prisma.user.update({ where: { id: taken.id }, data: { email: null } })] : []),
      this.prisma.user.update({ where: { id: t.userId }, data: { email: t.email, emailVerifiedAt: new Date() } }),
      this.prisma.emailToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
    ]);
    return { verified: true, email: t.email };
  }

  /**
   * 비밀번호 찾기: 아이디나 이메일을 받는다. 계정이 있는지는 알려주지 않는다(항상 같은 응답).
   * 인증한 이메일이 있는 계정에만 재설정 링크를 보낸다.
   */
  async forgot(identifier: string) {
    this.ready();
    const id = identifier.trim().toLowerCase();
    const u = await this.prisma.user.findFirst({
      where: { OR: [{ loginId: id }, { email: id }], emailVerifiedAt: { not: null }, isGuest: false },
      select: { id: true, email: true, loginId: true },
    });
    if (u?.email) {
      const raw = await this.token(u.id, EmailTokenKind.RESET, u.email, RESET_MINUTES * 60_000);
      await this.mail.send({
        to: u.email,
        subject: '[말랑말랑] 비밀번호 다시 만들기',
        text: `아이디 ${u.loginId ?? '(간편 로그인 계정)'}의 비밀번호를 다시 만들 수 있는 링크예요. (${RESET_MINUTES}분 동안 한 번만 쓸 수 있어요)\n\n${web()}/reset-password?token=${raw}\n\n직접 요청하지 않았다면 이 메일은 무시해 주세요. 비밀번호는 바뀌지 않아요.`,
      });
    }
    return { sent: true };
  }

  async reset(raw: string, next: string, loginId?: string) {
    const t = await this.prisma.emailToken.findUnique({ where: { tokenHash: sha(raw) } });
    if (!t || t.kind !== EmailTokenKind.RESET || t.usedAt || t.expiresAt < new Date()) throw new BadRequestException({ message: '링크가 만료됐거나 이미 썼어요. 비밀번호 찾기를 다시 해 주세요', code: 'BAD_TOKEN' });
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: t.userId }, select: { loginId: true } });
    let newId = u.loginId;
    if (!newId) {
      if (!loginId) throw new BadRequestException('아이디도 함께 만들어 주세요');
      const exists = await this.prisma.user.findUnique({ where: { loginId }, select: { id: true } });
      if (exists) throw new ConflictException('이미 쓰고 있는 아이디예요');
      newId = loginId;
    }
    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: t.userId }, data: { loginId: newId, passwordHash: await argon2.hash(next, { type: argon2.argon2id }), failedLogins: 0, lockedUntil: null } }),
      this.prisma.emailToken.update({ where: { id: t.id }, data: { usedAt: new Date() } }),
      // 비밀번호가 바뀌면 다른 기기 로그인은 모두 끊는다
      this.prisma.refreshToken.updateMany({ where: { userId: t.userId, revokedAt: null }, data: { revokedAt: new Date() } }),
    ]);
    return { reset: true, loginId: newId };
  }
}
