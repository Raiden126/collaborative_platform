import type { ActionContext, Module } from 'vuex';
import type { AnyWorkflowEvent } from '@cwb/shared';
import { eventsApi } from '@/api';
import { offlineQueue } from '@/offline/db';
import type { RootState } from '../types';

export interface OfflineState {
  online: boolean;
  pending: number;
  syncing: boolean;
  // True once we've gone offline with unsynced edits — drives the "Synced" toast.
  pendingWasOffline: boolean;
}

type Ctx = ActionContext<OfflineState, RootState>;

export const offline: Module<OfflineState, RootState> = {
  namespaced: true,
  state: (): OfflineState => ({
    online: navigator.onLine,
    pending: 0,
    syncing: false,
    pendingWasOffline: false,
  }),
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
    setPendingWasOffline(s: OfflineState, v: boolean) {
      s.pendingWasOffline = v;
    },
  },
  actions: {
    // Listen to browser connectivity; drain the outbox when we come back online.
    init({ commit, dispatch }: Ctx) {
      window.addEventListener('online', () => {
        commit('setOnline', true);
        dispatch('sync');
      });
      window.addEventListener('offline', () => {
        commit('setOnline', false);
        commit('setPendingWasOffline', true);
      });
      dispatch('refreshCount');
    },
    async refreshCount({ commit }: Ctx) {
      commit('setPending', await offlineQueue.count());
    },
    // Durable outbox: every edit is persisted here first, then synced. Acts as
    // the reliability buffer for ALL edits, not just those made while offline.
    async enqueue({ commit }: Ctx, payload: { workflowId: number; event: AnyWorkflowEvent }) {
      await offlineQueue.add({ ...payload, createdAt: Date.now() });
      commit('setPending', await offlineQueue.count());
    },
    /**
     * Drain the outbox to the server, preserving order. Prefers the socket
     * (low-latency + live broadcast to collaborators) and awaits its ack;
     * falls back to the HTTP append endpoint when the socket is down. Stops on
     * the first failure and leaves the rest queued to retry on the next
     * edit / reconnect / `online` event.
     */
    async sync({ commit, dispatch, rootState }: Ctx) {
      if (rootState.offline.syncing) return;
      commit('setSyncing', true);
      let delivered = 0;
      try {
        // Re-query each pass so events enqueued mid-sync are also drained.
        for (let guard = 0; guard < 1000; guard++) {
          const items = await offlineQueue.all();
          if (!items.length) break;

          // Process one workflow's events per pass, in order.
          const workflowId = items[0].workflowId;
          const group = items.filter((i) => i.workflowId === workflowId);
          const ids = group.map((i) => i.id!);
          const events = group.map((i) => i.event);

          try {
            if (rootState.realtime.connected) {
              await dispatch('realtime/sendEvents', { workflowId, events }, { root: true });
            } else if (navigator.onLine) {
              await eventsApi.append(workflowId, events);
            } else {
              break; // truly offline — keep everything queued
            }
            await offlineQueue.clear(ids);
            delivered += events.length;
          } catch {
            break; // delivery failed — retry later, preserving order
          }
        }
      } finally {
        commit('setSyncing', false);
        const remaining = await offlineQueue.count();
        commit('setPending', remaining);
        // Notify only when we cleared a backlog left over from being offline.
        if (delivered > 0 && remaining === 0 && rootState.offline.pendingWasOffline) {
          commit('setPendingWasOffline', false);
          dispatch(
            'notifications/push',
            { type: 'SYNCED', title: 'Synced', message: 'Offline changes uploaded' },
            { root: true },
          );
        }
      }
    },
    // Back-compat alias.
    flush({ dispatch }: Ctx) {
      return dispatch('sync');
    },
  },
};
