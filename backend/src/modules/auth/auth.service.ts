import { BadRequestException, ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { AuthProvider, ConsentType, User } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../common/prisma.service';
import { LOGIN_ID_RULE, SignUpDto } from './auth.dto';

export const CONSENT_VERSION = '2026-11-10';
const MAX_FAILS = 5;
const LOCK_MINUTES = 10;
const REFRESH_DAYS = 30;

const sha = (s: string) => createHash('sha256').update(s).digest('hex');

export interface TokenPair {
  accessToken: string;
  refreshToken: string;
  user: PublicUser;
}
export interface PublicUser {
  id: string;
  name: string;
  loginId: string | null;
  role: string;
  isGuest: boolean;
  hasBaseline: boolean;
  onboarded: boolean;
}

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  toPublic(u: User & { settings?: { onboardedAt: Date | null } | null }): PublicUser {
    return {
      id: u.id,
      name: u.name,
      loginId: u.loginId,
      role: u.role,
      isGuest: u.isGuest,
      hasBaseline: !!u.baseline,
      onboarded: !!u.settings?.onboardedAt,
    };
  }

  async isLoginIdAvailable(loginId: string) {
    if (!LOGIN_ID_RULE.test(loginId)) return { available: false, reason: 'format' as const };
    const exists = await this.prisma.user.findUnique({ where: { loginId } });
    return { available: !exists, reason: exists ? ('taken' as const) : null };
  }

  /** 만 나이(대략): 올해 - 출생연도 - (생일 전일 수 있어 1을 뺌) */
  private isUnder14(birthYear?: number) {
    if (!birthYear) return false;
    return new Date().getFullYear() - birthYear - 1 < 14;
  }

  async signUp(dto: SignUpDto, guestUserId?: string): Promise<TokenPair> {
    if (!dto.agreeTerms) throw new BadRequestException('이용약관과 개인정보 처리방침에 동의해 주세요');
    const under14 = this.isUnder14(dto.birthYear);
    if (under14 && (!dto.guardianName || !dto.guardianContact || !dto.guardianAgree)) {
      throw new BadRequestException({ message: '만 14세 미만은 보호자 동의가 필요해요', code: 'GUARDIAN_REQUIRED' });
    }
    const { available } = await this.isLoginIdAvailable(dto.loginId);
    if (!available) throw new ConflictException('이미 쓰고 있는 아이디예요');
    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const consents = [
      { type: ConsentType.TERMS, version: CONSENT_VERSION, granted: true },
      { type: ConsentType.PRIVACY, version: CONSENT_VERSION, granted: true },
      ...(under14
        ? [{ type: ConsentType.GUARDIAN, version: CONSENT_VERSION, granted: true, guardianName: dto.guardianName, guardianContact: dto.guardianContact }]
        : []),
    ];

    // 게스트로 진단한 기록을 그대로 이어받는다 (로그인 예외 메모 6번)
    const guest = guestUserId ? await this.prisma.user.findUnique({ where: { id: guestUserId } }) : null;
    const user = guest?.isGuest
      ? await this.prisma.user.update({
          where: { id: guest.id },
          data: { loginId: dto.loginId, passwordHash, name: dto.name, birthYear: dto.birthYear, isGuest: false, consents: { create: consents } },
          include: { settings: true },
        })
      : await this.prisma.user.create({
          data: {
            loginId: dto.loginId,
            passwordHash,
            name: dto.name,
            birthYear: dto.birthYear,
            settings: { create: {} },
            streak: { create: {} },
            consents: { create: consents },
          },
          include: { settings: true },
        });
    return this.issue(user);
  }

  async createGuest(): Promise<TokenPair> {
    const user = await this.prisma.user.create({
      data: { name: '손님', isGuest: true, settings: { create: {} }, streak: { create: {} } },
      include: { settings: true },
    });
    return this.issue(user);
  }

  async login(loginId: string, password: string): Promise<TokenPair> {
    const fail = () =>
      new UnauthorizedException({ message: '아이디 또는 비밀번호가 맞지 않아요', code: 'BAD_CREDENTIALS' });
    const user = await this.prisma.user.findUnique({ where: { loginId }, include: { settings: true } });
    if (!user || !user.passwordHash) {
      await argon2.hash(password); // 응답 시간으로 아이디 존재 여부를 알 수 없게
      throw fail();
    }
    if (user.lockedUntil && user.lockedUntil > new Date()) {
      throw new UnauthorizedException({
        message: `${LOCK_MINUTES}분 동안 로그인이 잠겼어요. 잠시 후 다시 시도하거나 비밀번호를 찾아주세요`,
        code: 'LOCKED',
        lockedUntil: user.lockedUntil,
      });
    }
    const ok = await argon2.verify(user.passwordHash, password);
    if (!ok) {
      const fails = user.failedLogins + 1;
      const locked = fails >= MAX_FAILS;
      await this.prisma.user.update({
        where: { id: user.id },
        data: { failedLogins: locked ? 0 : fails, lockedUntil: locked ? new Date(Date.now() + LOCK_MINUTES * 60_000) : null },
      });
      throw new UnauthorizedException({
        message: locked ? `${MAX_FAILS}번 틀려서 ${LOCK_MINUTES}분 동안 로그인이 잠겼어요` : '아이디 또는 비밀번호가 맞지 않아요',
        code: locked ? 'LOCKED' : 'BAD_CREDENTIALS',
        attempts: locked ? MAX_FAILS : fails,
        max: MAX_FAILS,
      } as any);
    }
    const fresh = await this.prisma.user.update({
      where: { id: user.id },
      data: { failedLogins: 0, lockedUntil: null },
      include: { settings: true },
    });
    return this.issue(fresh);
  }

  async loginWithIdentity(provider: AuthProvider, providerUserId: string, name: string, email?: string) {
    const identity = await this.prisma.identity.findUnique({
      where: { provider_providerUserId: { provider, providerUserId } },
      include: { user: { include: { settings: true } } },
    });
    if (identity) return this.issue(identity.user, randomUUID(), 'oauth');
    const user = await this.prisma.user.create({
      data: {
        name: name.slice(0, 30) || '말랑이 친구',
        identities: { create: { provider, providerUserId, email } },
        settings: { create: {} },
        streak: { create: {} },
        consents: {
          create: [
            { type: ConsentType.TERMS, version: CONSENT_VERSION, granted: true },
            { type: ConsentType.PRIVACY, version: CONSENT_VERSION, granted: true },
          ],
        },
      },
      include: { settings: true },
    });
    return this.issue(user, randomUUID(), 'oauth');
  }

  async linkIdentity(userId: string, provider: AuthProvider, providerUserId: string, email?: string) {
    const existing = await this.prisma.identity.findUnique({ where: { provider_providerUserId: { provider, providerUserId } } });
    if (existing && existing.userId !== userId) throw new ConflictException({ message: '이 계정은 다른 말랑말랑 계정에 연결되어 있어요', code: 'IDENTITY_TAKEN' });
    if (!existing) await this.prisma.identity.create({ data: { userId, provider, providerUserId, email } });
    const user = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { settings: true } });
    return this.issue(user);
  }

  async issue(user: User & { settings?: any }, family: string = randomUUID(), amr: 'pwd' | 'oauth' | 'refresh' = 'pwd'): Promise<TokenPair> {
    const accessToken = this.jwt.sign({ sub: user.id, role: user.role, guest: user.isGuest, typ: 'access', amr }, { expiresIn: '15m' });
    const refreshToken = randomBytes(32).toString('base64url');
    await this.prisma.refreshToken.create({
      data: { userId: user.id, tokenHash: sha(refreshToken), family, expiresAt: new Date(Date.now() + REFRESH_DAYS * 86400_000) },
    });
    return { accessToken, refreshToken, user: this.toPublic(user) };
  }

  /** 리프레시 토큰 회전. 이미 쓴 토큰이 다시 오면 같은 묶음을 모두 폐기(탈취 의심). */
  async refresh(refreshToken: string): Promise<TokenPair> {
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash: sha(refreshToken) },
      include: { user: { include: { settings: true } } },
    });
    if (!row || row.expiresAt < new Date()) throw new UnauthorizedException('다시 로그인해 주세요');
    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({ where: { family: row.family }, data: { revokedAt: new Date() } });
      throw new UnauthorizedException('다시 로그인해 주세요');
    }
    await this.prisma.refreshToken.update({ where: { id: row.id }, data: { revokedAt: new Date() } });
    return this.issue(row.user, row.family, 'refresh');
  }

  async logout(refreshToken: string) {
    await this.prisma.refreshToken.updateMany({ where: { tokenHash: sha(refreshToken) }, data: { revokedAt: new Date() } });
  }

  /**
   * 비밀번호 바꾸기 · 잊었을 때 새로 만들기.
   * 지금 비밀번호를 알거나, 카카오·구글로 방금(15분 안) 로그인했으면 새로 만들 수 있다. 아이디가 없으면 아이디도 함께 만든다.
   */
  async changePassword(userId: string, amr: string | undefined, dto: { current?: string; next: string; loginId?: string }) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId } });
    if (u.passwordHash && amr !== 'oauth') {
      if (!dto.current || !(await argon2.verify(u.passwordHash, dto.current))) throw new UnauthorizedException({ message: '지금 비밀번호가 맞지 않아요', code: 'BAD_CURRENT' });
    }
    if (!u.passwordHash && amr !== 'oauth' && !u.isGuest) throw new UnauthorizedException('카카오·구글로 다시 로그인한 뒤 바로 만들어 주세요');
    let loginId = u.loginId;
    if (!loginId) {
      if (!dto.loginId) throw new BadRequestException('아이디도 함께 만들어 주세요');
      const { available } = await this.isLoginIdAvailable(dto.loginId);
      if (!available) throw new ConflictException('이미 쓰고 있는 아이디예요');
      loginId = dto.loginId;
    }
    await this.prisma.user.update({ where: { id: userId }, data: { loginId, passwordHash: await argon2.hash(dto.next, { type: argon2.argon2id }), failedLogins: 0, lockedUntil: null } });
    await this.prisma.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: new Date() } });
    const fresh = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { settings: true } });
    return this.issue(fresh);
  }

  async me(userId: string) {
    const u = await this.prisma.user.findUniqueOrThrow({ where: { id: userId }, include: { settings: true } });
    return this.toPublic(u);
  }
}
