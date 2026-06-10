import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeEvent } from '@cwb/shared';
import { createAppStore } from '@/store';

// Avoid touching IndexedDB / sockets / network in this pure store test.
vi.mock('@/offline/db', () => ({
  offlineQueue: { add: vi.fn(), all: vi.fn().mockResolvedValue([]), count: vi.fn().mockResolvedValue(0), clear: vi.fn() },
}));
vi.mock('@/api', () => ({
  workflowsApi: { update: vi.fn().mockResolvedValue({}) },
  eventsApi: { append: vi.fn().mockResolvedValue({}) },
}));

describe('workflow module: event pipeline + undo/redo (features 9 & 18)', () => {
  let store: ReturnType<typeof createAppStore>;

  beforeEach(() => {
    store = createAppStore();
    // Pretend a workflow is open but offline, so events buffer rather than hit a socket.
    store.commit('workflow/setActive', { id: 1, meta: { name: 'T', status: 'DRAFT', version: 1 } });
  });

  it('applies a NODE_CREATED event to the normalized stores', async () => {
    await store.dispatch(
      'workflow/commitEvent',
      makeEvent('NODE_CREATED', {
        node: { id: 'n1', type: 'action', position: { x: 0, y: 0 }, data: {} },
      }),
    );
    expect(store.getters['nodes/count']).toBe(1);
  });

  it('undo and redo move the graph backward and forward', async () => {
    await store.dispatch('workflow/commitEvent', makeEvent('NODE_CREATED', {
      node: { id: 'n1', type: 'action', position: { x: 0, y: 0 }, data: {} },
    }));
    expect(store.getters['nodes/count']).toBe(1);

    store.dispatch('workflow/undo');
    expect(store.getters['nodes/count']).toBe(0);
    expect(store.getters['workflow/canRedo']).toBe(true);

    store.dispatch('workflow/redo');
    expect(store.getters['nodes/count']).toBe(1);
  });

  it('caps history near the 100-action limit', async () => {
    for (let i = 0; i < 120; i++) {
      await store.dispatch('workflow/commitEvent', makeEvent('NODE_CREATED', {
        node: { id: `n${i}`, type: 'action', position: { x: i, y: i }, data: {} },
      }));
    }
    expect(store.state.workflow.past.length).toBeLessThanOrEqual(100);
  });
});
