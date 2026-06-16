import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';
import {
  MailtrapClient,
} from 'mailtrap';

/**
 * Pluggable delivery transports. The engine depends on these interfaces, not on
 * any concrete provider. The factories below pick a REAL provider when the
 * relevant credentials are configured, and fall back to a safe mock otherwise —
 * so the app runs out-of-the-box, and "just works in production" once env vars
 * are set, with no code change.
 */
export const EMAIL_TRANSPORT = Symbol('EMAIL_TRANSPORT');
export const SMS_TRANSPORT = Symbol('SMS_TRANSPORT');

export interface EmailMessage {
  to: string;
  subject?: string;
  body?: string;
}
export interface EmailResult {
  messageId: string;
  accepted: string[];
  provider: string;
}
export interface EmailTransport {
  send(message: EmailMessage): Promise<EmailResult>;
}

export interface SmsMessage {
  to: string;
  message?: string;
}
export interface SmsResult {
  sid: string;
  to: string;
  provider: string;
}
export interface SmsTransport {
  send(message: SmsMessage): Promise<SmsResult>;
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
let seq = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

// ---------------------------------------------------------------------------
// Real implementations
// ---------------------------------------------------------------------------

/** Production email via SMTP (works with SES, Gmail, Mailgun, Postmark, …). */
export class SmtpEmailTransport implements EmailTransport {
  private readonly logger = new Logger('SmtpEmailTransport');
  private readonly transporter: nodemailer.Transporter;

  constructor(
    private readonly opts: {
      host: string;
      port: number;
      secure: boolean;
      user?: string;
      pass?: string;
      from: string;
    },
  ) {
    this.transporter = nodemailer.createTransport({
      host: opts.host,
      port: opts.port,
      secure: opts.secure,
      auth: opts.user ? { user: opts.user, pass: opts.pass } : undefined,
    });
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!EMAIL_RE.test(message.to)) throw new Error(`Invalid recipient email: "${message.to}"`);
    const info = await this.transporter.sendMail({
      from: this.opts.from,
      to: message.to,
      subject: message.subject ?? '(no subject)',
      text: message.body ?? '',
    });
    this.logger.log(`email → ${message.to} (${info.messageId})`);
    return {
      messageId: info.messageId,
      accepted: (info.accepted ?? []).map(String),
      provider: 'smtp',
    };
  }
}

export class MailtrapEmailTransport implements EmailTransport {
  private readonly logger = new Logger('MailtrapEmailTransport');

  private readonly client: MailtrapClient;

  constructor(
    private readonly token: string,
    private readonly from: {
      email: string;
      name?: string;
    },
  ) {
    this.client = new MailtrapClient({
      token: this.token,
    });
  }

  async send(message: EmailMessage): Promise<EmailResult> {
    if (!EMAIL_RE.test(message.to)) {
      throw new Error(`Invalid recipient email: "${message.to}"`);
    }

    const response = await this.client.send({
      from: {
        email: this.from.email,
        name: this.from.name ?? 'Workflow Engine',
      },
      to: [
        {
          email: message.to,
        },
      ],
      subject: message.subject ?? '(no subject)',
      text: message.body ?? '',
    });

    this.logger.log(`email -> ${message.to}`);

    return {
      messageId: response.message_ids?.[0] ?? nextId('msg'),
      accepted: [message.to],
      provider: 'mailtrap',
    };
  }
}

/** Production SMS via Twilio's REST API (no SDK dependency — plain HTTPS). */
export class TwilioSmsTransport implements SmsTransport {
  private readonly logger = new Logger('TwilioSmsTransport');

  constructor(
    private readonly accountSid: string,
    private readonly authToken: string,
    private readonly from: string,
  ) {}

  async send(message: SmsMessage): Promise<SmsResult> {
    if (!message.to || message.to.replace(/[^\d]/g, '').length < 7) {
      throw new Error(`Invalid recipient phone number: "${message.to}"`);
    }
    const url = `https://api.twilio.com/2010-04-01/Accounts/${this.accountSid}/Messages.json`;
    const auth = Buffer.from(`${this.accountSid}:${this.authToken}`).toString('base64');
    const body = new URLSearchParams({
      To: message.to,
      From: this.from,
      Body: message.message ?? '',
    });
    const res = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Basic ${auth}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body,
    });
    const data = (await res.json()) as { sid?: string; message?: string };
    if (!res.ok) throw new Error(data.message ?? `Twilio error ${res.status}`);
    this.logger.log(`sms → ${message.to} (${data.sid})`);
    return { sid: data.sid ?? nextId('sms'), to: message.to, provider: 'twilio' };
  }
}

// ---------------------------------------------------------------------------
// Mock fallbacks (used when no provider is configured) — validate + log, no send.
// ---------------------------------------------------------------------------

export class MockEmailTransport implements EmailTransport {
  private readonly logger = new Logger('EmailTransport');
  async send(message: EmailMessage): Promise<EmailResult> {
    if (!EMAIL_RE.test(message.to)) throw new Error(`Invalid recipient email: "${message.to}"`);
    this.logger.log(`[mock] email → ${message.to} :: ${message.subject ?? '(no subject)'}`);
    return { messageId: nextId('msg'), accepted: [message.to], provider: 'mock' };
  }
}

export class MockSmsTransport implements SmsTransport {
  private readonly logger = new Logger('SmsTransport');
  async send(message: SmsMessage): Promise<SmsResult> {
    if (!message.to || message.to.replace(/[^\d]/g, '').length < 7) {
      throw new Error(`Invalid recipient phone number: "${message.to}"`);
    }
    this.logger.log(`[mock] sms → ${message.to}`);
    return { sid: nextId('sms'), to: message.to, provider: 'mock' };
  }
}

// ---------------------------------------------------------------------------
// Factories — choose real vs mock based on configured credentials.
// ---------------------------------------------------------------------------

// export function createEmailTransport(config: ConfigService): EmailTransport {
//   const host = config.get<string>('SMTP_HOST');
//   if (!host) {
//     new Logger('EmailTransport').warn('SMTP not configured — using mock email transport');
//     return new MockEmailTransport();
//   }
//   const user = config.get<string>('SMTP_USER');
//   return new SmtpEmailTransport({
//     host,
//     port: Number(config.get('SMTP_PORT') ?? 587),
//     secure: String(config.get('SMTP_SECURE')) === 'true',
//     user,
//     pass: config.get<string>('SMTP_PASS'),
//     from: config.get<string>('EMAIL_FROM') ?? user ?? 'no-reply@cwb.dev',
//   });
// }

export function createEmailTransport(
  config: ConfigService,
): EmailTransport {
  const token = config.get<string>('MAILTRAP_TOKEN');

  if (!token) {
    new Logger('EmailTransport').warn(
      'Mailtrap not configured — using mock email transport',
    );

    return new MockEmailTransport();
  }

  return new MailtrapEmailTransport(token, {
    email:
      config.get<string>('MAILTRAP_FROM_EMAIL') ??
      'no-reply@example.com',

    name:
      config.get<string>('MAILTRAP_FROM_NAME') ??
      'Workflow Builder',
  });
}

export function createSmsTransport(config: ConfigService): SmsTransport {
  const sid = config.get<string>('TWILIO_ACCOUNT_SID');
  const token = config.get<string>('TWILIO_AUTH_TOKEN');
  const from = config.get<string>('TWILIO_FROM');
  if (!sid || !token || !from) {
    new Logger('SmsTransport').warn('Twilio not configured — using mock SMS transport');
    return new MockSmsTransport();
  }
  return new TwilioSmsTransport(sid, token, from);
}
