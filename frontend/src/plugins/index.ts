import { defineAsyncComponent } from 'vue';
import { registerNodeType } from '@/builder/nodeRegistry';

/**
 * Plugin entry point (feature 20). External developers register custom node types,
 * triggers and actions here (or via their own module that calls registerNodeType)
 * WITHOUT modifying any core file. The registry + dynamic form engine do the rest.
 */
export function registerPlugins() {
  // Example third-party "Slack" action node.
  registerNodeType({
    type: 'slack',
    label: 'Slack',
    category: 'Integration',
    icon: '🟣',
    color: '#611f69',
    component: defineAsyncComponent(() => import('./examples/SlackNode.vue')),
    defaultData: { channel: '#general', text: '' },
    form: [
      { name: 'channel', label: 'Channel', fieldType: 'text', default: '#general' },
      { name: 'text', label: 'Message', fieldType: 'textarea' },
    ],
  });
}
