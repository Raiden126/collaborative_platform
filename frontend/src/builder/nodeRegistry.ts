import { defineAsyncComponent, markRaw, reactive, type Component } from 'vue';
import type { NodeDefinition } from './types';

/**
 * Central node-type registry — the seam for dynamic rendering (feature 4) and the
 * plugin architecture (feature 20). The canvas resolves a node's component from
 * here by its `type` string; there is no hardcoded switch anywhere.
 *
 * Components are loaded asynchronously via `defineAsyncComponent`, so adding a new
 * node type (built-in or plugin) never bloats the initial bundle.
 */
const registry = reactive(new Map<string, NodeDefinition>());

export function registerNodeType(def: NodeDefinition) {
  // markRaw so Vue doesn't make the component definition reactive.
  registry.set(def.type, { ...def, component: markRaw(def.component as object) as Component });
}

export function getNodeDefinition(type: string): NodeDefinition | undefined {
  return registry.get(type);
}

export function listNodeDefinitions(): NodeDefinition[] {
  return [...registry.values()];
}

/** Component map for Vue Flow's `:node-types` binding, built from the registry. */
export function nodeTypeComponents(): Record<string, Component> {
  const map: Record<string, Component> = {};
  for (const def of registry.values()) map[def.type] = def.component as Component;
  return map;
}

// --- Built-in node types ----------------------------------------------------
// Each maps to its own async-loaded SFC (a thin wrapper over BaseNode).
const async = (loader: () => Promise<unknown>) => defineAsyncComponent(loader as never);

registerNodeType({
  type: 'trigger',
  label: 'Trigger',
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

registerNodeType({
  type: 'condition',
  label: 'Condition',
  category: 'Logic',
  icon: '◆',
  color: '#f59e0b',
  component: async(() => import('./nodes/ConditionNode.vue')),
  defaultData: { expression: '' },
  form: [
    { name: 'expression', label: 'Expression', fieldType: 'text', placeholder: 'amount > 100' },
  ],
});

registerNodeType({
  type: 'action',
  label: 'Action',
  category: 'Action',
  icon: '▶',
  color: '#10b981',
  component: async(() => import('./nodes/ActionNode.vue')),
  defaultData: { name: '' },
  form: [{ name: 'name', label: 'Action name', fieldType: 'text', required: true }],
});

registerNodeType({
  type: 'delay',
  label: 'Delay',
  category: 'Logic',
  icon: '⏱',
  color: '#8b5cf6',
  component: async(() => import('./nodes/DelayNode.vue')),
  defaultData: { seconds: 60 },
  form: [{ name: 'seconds', label: 'Delay (seconds)', fieldType: 'number', default: 60 }],
});

registerNodeType({
  type: 'webhook',
  label: 'Webhook',
  category: 'Integration',
  icon: '🪝',
  color: '#14b8a6',
  component: async(() => import('./nodes/WebhookNode.vue')),
  defaultData: { url: '', method: 'POST' },
  form: [
    { name: 'url', label: 'URL', fieldType: 'text', placeholder: 'https://…', required: true },
    {
      name: 'method',
      label: 'Method',
      fieldType: 'select',
      options: ['GET', 'POST', 'PUT', 'DELETE'].map((v) => ({ label: v, value: v })),
      default: 'POST',
    },
  ],
});

registerNodeType({
  type: 'email',
  label: 'Email',
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

registerNodeType({
  type: 'sms',
  label: 'SMS',
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
