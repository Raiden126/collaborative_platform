import { defineAsyncComponent, markRaw, reactive, type Component } from 'vue';
import type { NodeDefinition } from './types';

const registry = reactive(new Map<string, NodeDefinition>());

export function registerNodeType(def: NodeDefinition) {
  registry.set(def.type, { ...def, component: markRaw(def.component as object) as Component });
}

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return registry.get(type);
}

export function listNodeDefinitions(): NodeDefinition[] {
  return [...registry.values()];
}

export function nodeTypeComponents(): Record<string, Component> {
  const map: Record<string, Component> = {};
  for (const def of registry.values()) map[def.type] = def.component as Component;
  return map;
}

const async = (loader: () => Promise<unknown>) => defineAsyncComponent(loader as never);

// ── TRIGGER ─────────────────────────────────────────────────────────────────
// Entry point of every workflow. Fires on manual click, a cron schedule, or an
// incoming HTTP webhook. All downstream nodes receive its payload via {{trigger.*}}.
registerNodeType({
  type: 'trigger',
  label: 'Trigger',
  description:
    'Entry point of the workflow. Fires manually, on a schedule, or via an incoming webhook. The trigger payload is available to all downstream nodes as {{trigger.*}}.',
  category: 'Trigger',
  icon: '⚡',
  color: '#6366f1',
  isTrigger: true,
  component: async(() => import('./nodes/TriggerNode.vue')),
  defaultData: { event: 'manual' },
  form: [
    {
      name: 'event',
      label: 'Trigger event',
      fieldType: 'select',
      options: [
        { label: 'Manual', value: 'manual' },
        { label: 'Schedule', value: 'schedule' },
        { label: 'Webhook', value: 'webhook' },
      ],
      default: 'manual',
    },
  ],
});

// ── CONDITION ────────────────────────────────────────────────────────────────
// Evaluates a JS-like expression against run context. Routes execution down the
// "true" or "false" branch. Supports ==, !=, >, <, >=, <=, contains.
// Example: {{trigger.amount}} > 100
registerNodeType({
  type: 'condition',
  label: 'Condition',
  description:
    'Evaluates an expression and routes to the "true" or "false" branch. Supports ==, !=, >, <, >=, <=, contains. Use {{trigger.field}} or {{nodeId.field}} references.',
  category: 'Logic',
  icon: '◆',
  color: '#f59e0b',
  component: async(() => import('./nodes/ConditionNode.vue')),
  defaultData: { expression: '' },
  outputs: [
    { id: 'true', label: 'true', color: '#10b981' },
    { id: 'false', label: 'false', color: '#ef4444' },
  ],
  form: [
    {
      name: 'expression',
      label: 'Expression',
      fieldType: 'text',
      placeholder: '{{trigger.amount}} > 100',
    },
  ],
});

// ── ACTION ───────────────────────────────────────────────────────────────────
// Generic named step — useful as a placeholder or custom logic marker. Set
// _fail: true in data to simulate a failure for testing error paths.
registerNodeType({
  type: 'action',
  label: 'Action',
  description:
    'Generic named step. Use as a placeholder, a logging point, or to test failure paths (set _fail: true in data). Passes through all interpolated data as output.',
  category: 'Action',
  icon: '▶',
  color: '#10b981',
  component: async(() => import('./nodes/ActionNode.vue')),
  defaultData: { name: '' },
  form: [{ name: 'name', label: 'Action name', fieldType: 'text', required: true }],
});

// ── DELAY ────────────────────────────────────────────────────────────────────
// Pauses execution for N seconds. In live mode waits (capped at 5 s to prevent
// hung runs); in simulate mode just records the intended duration.
registerNodeType({
  type: 'delay',
  label: 'Delay',
  description:
    'Pauses the workflow for a specified number of seconds. In live mode waits up to 5 s; in simulate mode records the intended duration without actually waiting.',
  category: 'Logic',
  icon: '⏱',
  color: '#8b5cf6',
  component: async(() => import('./nodes/DelayNode.vue')),
  defaultData: { seconds: 60 },
  form: [{ name: 'seconds', label: 'Delay (seconds)', fieldType: 'number', default: 60 }],
});

// ── WEBHOOK ──────────────────────────────────────────────────────────────────
// Makes a real outbound HTTP request. Body and URL support {{ref}} interpolation.
// Captures status, headers summary, and response body (capped at 4 KB).
registerNodeType({
  type: 'webhook',
  label: 'Webhook',
  description:
    'Makes a real outbound HTTP request (GET/POST/PUT/DELETE). URL and body support {{ref}} interpolation. Captures status code and response body (up to 4 KB). Fails the node on non-2xx by default.',
  category: 'Integration',
  icon: '🪝',
  color: '#14b8a6',
  component: async(() => import('./nodes/WebhookNode.vue')),
  defaultData: { url: '', method: 'POST', body: '' },
  form: [
    { name: 'url', label: 'URL', fieldType: 'text', placeholder: 'https://…', required: true },
    {
      name: 'method',
      label: 'Method',
      fieldType: 'select',
      options: ['GET', 'POST', 'PUT', 'DELETE'].map((v) => ({ label: v, value: v })),
      default: 'POST',
    },
    {
      name: 'body',
      label: 'Body (JSON, supports {{refs}})',
      fieldType: 'textarea',
      placeholder: '{ "amount": {{trigger.amount}} }',
    },
  ],
});

// ── EMAIL ────────────────────────────────────────────────────────────────────
// Sends an email via configured SMTP (Nodemailer). Falls back to a console mock
// in dev when SMTP_HOST is not set. Subject and body support {{ref}} interpolation.
registerNodeType({
  type: 'email',
  label: 'Email',
  description:
    'Sends an email via SMTP (Nodemailer). Configure SMTP_HOST/USER/PASS env vars for production. Falls back to a safe console mock in dev. Subject and body support {{ref}} interpolation.',
  category: 'Action',
  icon: '✉️',
  color: '#3b82f6',
  component: async(() => import('./nodes/EmailNode.vue')),
  defaultData: { to: '', subject: '' },
  form: [
    { name: 'to', label: 'To', fieldType: 'email', required: true },
    { name: 'subject', label: 'Subject', fieldType: 'text' },
    { name: 'body', label: 'Body', fieldType: 'textarea' },
  ],
});

// ── SMS ──────────────────────────────────────────────────────────────────────
// Sends an SMS via Twilio. Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and
// TWILIO_FROM env vars. Falls back to a console mock when unconfigured.
registerNodeType({
  type: 'sms',
  label: 'SMS',
  description:
    'Sends an SMS via Twilio. Requires TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM env vars. Falls back to a console mock in dev. The "to" and "message" fields support {{ref}} interpolation.',
  category: 'Action',
  icon: '💬',
  color: '#ec4899',
  component: async(() => import('./nodes/SmsNode.vue')),
  defaultData: { to: '', message: '' },
  form: [
    { name: 'to', label: 'Phone', fieldType: 'text', required: true },
    { name: 'message', label: 'Message', fieldType: 'textarea' },
  ],
});

// ── SLACK ────────────────────────────────────────────────────────────────────
// Posts a message to a Slack channel. Uses SLACK_BOT_TOKEN (chat.postMessage)
// or SLACK_WEBHOOK_URL (Incoming Webhooks). Falls back to a console mock in dev.
registerNodeType({
  type: 'slack',
  label: 'Slack',
  description:
    'Posts a message to a Slack channel. Set SLACK_BOT_TOKEN (preferred) or SLACK_WEBHOOK_URL. Falls back to a console mock in dev. All fields support {{ref}} interpolation.',
  category: 'Integration',
  icon: '💼',
  color: '#4a154b',
  component: async(() => import('./nodes/SlackNode.vue')),
  defaultData: { channel: '#general', text: '' },
  form: [
    { name: 'channel', label: 'Channel', fieldType: 'text', placeholder: '#general', required: true },
    { name: 'text', label: 'Message', fieldType: 'textarea', required: true },
    { name: 'username', label: 'Bot name (optional)', fieldType: 'text' },
    { name: 'iconEmoji', label: 'Icon emoji (optional)', fieldType: 'text', placeholder: ':robot_face:' },
  ],
});