import { Injectable, Logger } from '@nestjs/common';
import nodemailer = require('nodemailer');

export interface SentMail {
  to: string;
  subject: string;
  text: string;
}

/**
 * 메일 보내기. `SMTP_URL`(예: smtps://user:pass@smtp.example.com:465)이 있으면 실제로 보낸다.
 * 테스트(NODE_ENV=test)에서는 보내지 않고 outbox 에 쌓는다. 둘 다 아니면 보낼 수 없음(enabled=false).
 */
@Injectable()
export class MailService {
  private log = new Logger('Mail');
  private transport = process.env.SMTP_URL ? nodemailer.createTransport(process.env.SMTP_URL) : null;
  readonly outbox: SentMail[] = [];

  enabled() {
    return !!this.transport || process.env.NODE_ENV === 'test';
  }

  async send(mail: SentMail) {
    if (process.env.NODE_ENV === 'test' && !this.transport) {
      this.outbox.push(mail);
      return;
    }
    if (!this.transport) throw new Error('메일 서버 설정(SMTP_URL)이 없어요');
    await this.transport.sendMail({ from: process.env.MAIL_FROM ?? '말랑말랑 <no-reply@localhost>', to: mail.to, subject: mail.subject, text: mail.text });
    this.log.log(`보냄: ${mail.subject} → ${mail.to.replace(/(.).*@/, '$1***@')}`);
  }
}
