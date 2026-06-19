import { ConfigService } from '@nestjs/config';

export interface SlackMessage {
  channel: string;
  text: string;
  username?: string;
  iconEmoji?: string;
}

export interface SlackSendResult {
  ok: boolean;
  channel?: string;
  ts?: string;
  error?: string;
}

export interface SlackTransport {
  send(msg: SlackMessage): Promise<SlackSendResult>;
}

export const SLACK_TRANSPORT = Symbol('SLACK_TRANSPORT');

/** Real Slack transport using Web API (token-based) or Incoming Webhooks */
class RealSlackTransport implements SlackTransport {
  constructor(
    private readonly token: string | undefined,
    private readonly webhookUrl: string | undefined,
  ) {}

  async send(msg: SlackMessage): Promise<SlackSendResult> {
    // Prefer Bot token (chat.postMessage) over incoming webhook
    if (this.token) {
      const res = await fetch('https://slack.com/api/chat.postMessage', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${this.token}`,
        },
        body: JSON.stringify({
          channel: msg.channel,
          text: msg.text,
          username: msg.username,
          icon_emoji: msg.iconEmoji,
        }),
      });
      const json = (await res.json()) as SlackSendResult;
      if (!json.ok) throw new Error(`Slack API error: ${json.error}`);
      return json;
    }

    if (this.webhookUrl) {
      const res = await fetch(this.webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: msg.text, channel: msg.channel, username: msg.username }),
      });
      if (!res.ok) throw new Error(`Slack webhook HTTP ${res.status}`);
      return { ok: true };
    }

    throw new Error('No Slack credentials configured (SLACK_BOT_TOKEN or SLACK_WEBHOOK_URL)');
  }
}

/** Safe mock — logs instead of sending, for dev environments */
class MockSlackTransport implements SlackTransport {
  async send(msg: SlackMessage): Promise<SlackSendResult> {
    console.log('[MockSlack] Would send to', msg.channel, ':', msg.text);
    return { ok: true, channel: msg.channel, ts: String(Date.now()) };
  }
}

export function createSlackTransport(config: ConfigService): SlackTransport {
  const token = config.get<string>('SLACK_BOT_TOKEN');
  const webhookUrl = config.get<string>('SLACK_WEBHOOK_URL');
  if (token || webhookUrl) return new RealSlackTransport(token, webhookUrl);
  return new MockSlackTransport();
}