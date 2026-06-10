import type { ActionContext, Module } from 'vuex';
import type { AnyWorkflowEvent } from '@cwb/shared';
import { eventsApi } from '@/api';
import { offlineQueue } from '@/offline/db';
import type { RootState } from '../types';

export interface OfflineState {
  online: boolean;
  pending: number;
  syncing: boolean;
}

type Ctx = ActionContext<OfflineState, RootState>;

export const offline: Module<OfflineState, RootState> = {
  namespaced: true,
  state: (): OfflineState => ({ online: navigator.onLine, pending: 0, syncing: false }),
  getters: {
    hasPending: (s: OfflineState) => s.pending > 0,
  },
  mutations: {
    setOnline(s: OfflineState, v: boolean) {
      s.online = v;
    },
    setPending(s: OfflineState, n: number) {
      s.pending = n;
    },
    setSyncing(s: OfflineState, v: boolean) {
      s.syncing = v;
    },
  },
  actions: {
    // Listen to browser connectivity; flush queue when we come back online.
    init({ commit, dispatch }: Ctx) {
      window.addEventListener('online', () => {
        commit('setOnline', true);
        dispatch('flush');
      });
      window.addEventListener('offline', () => commit('setOnline', false));
      dispatch('refreshCount');
    },
    async refreshCount({ commit }: Ctx) {
      commit('setPending', await offlineQueue.count());
    },
    async enqueue({ commit }: Ctx, payload: { workflowId: number; event: AnyWorkflowEvent }) {
      await offlineQueue.add({ ...payload, createdAt: Date.now() });
      commit('setPending', await offlineQueue.count());
    },
    // Flush buffered events per workflow, in order, via the HTTP append endpoint.
    async flush({ commit, dispatch }: Ctx) {
      if (!navigator.onLine) return;
      commit('setSyncing', true);
      try {
        const items = await offlineQueue.all();
        if (!items.length) return;
        const byWorkflow = new Map<number, { ids: number[]; events: AnyWorkflowEvent[] }>();
        for (const it of items) {
          const bucket = byWorkflow.get(it.workflowId) ?? { ids: [], events: [] };
          bucket.ids.push(it.id!);
          bucket.events.push(it.event);
          byWorkflow.set(it.workflowId, bucket);
        }
        for (const [workflowId, { ids, events }] of byWorkflow) {
          await eventsApi.append(workflowId, events);
          await offlineQueue.clear(ids);
        }
        dispatch(
          'notifications/push',
          { type: 'SYNCED', title: 'Synced', message: 'Offline changes uploaded' },
          { root: true },
        );
      } finally {
        commit('setSyncing', false);
        commit('setPending', await offlineQueue.count());
      }
    },
  },
};
