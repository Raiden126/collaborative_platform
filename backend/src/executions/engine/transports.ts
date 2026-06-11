import { Logger } from '@nestjs/common';

/**
 * Pluggable delivery transports. The engine depends on these interfaces, not on
 * any concrete provider — swap in SMTP/SendGrid/Twilio in production by binding a
 * different implementation to the EMAIL_TRANSPORT / SMS_TRANSPORT tokens.
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

let seq = 0;
const nextId = (prefix: string) => `${prefix}_${Date.now().toString(36)}_${(seq++).toString(36)}`;

/**
 * Default transports for dev/simulation: validate input and return a realistic
 * provider-shaped result without contacting an external service. Production
 * deployments override these via DI.
 */
export class MockEmailTransport implements EmailTransport {
  private readonly logger = new Logger('EmailTransport');
  async send(message: EmailMessage): Promise<EmailResult> {
    if (!message.to || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(message.to)) {
      throw new Error(`Invalid recipient email: "${message.to}"`);
    }
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
