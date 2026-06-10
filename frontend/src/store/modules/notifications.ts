import type { ActionContext, Module } from 'vuex';
import { uid } from '@/utils/id';
import type { RootState } from '../types';

export interface Notification {
  id: string;
  type: string;
  title: string;
  message: string;
  timestamp: number;
}

export interface NotificationsState {
  items: Notification[];
}

type Ctx = ActionContext<NotificationsState, RootState>;
const AUTO_DISMISS_MS = 5000;

export const notifications: Module<NotificationsState, RootState> = {
  namespaced: true,
  state: (): NotificationsState => ({ items: [] }),
  mutations: {
    add(s: NotificationsState, n: Notification) {
      s.items = [n, ...s.items].slice(0, 20);
    },
    remove(s: NotificationsState, id: string) {
      s.items = s.items.filter((n) => n.id !== id);
    },
  },
  actions: {
    push({ commit }: Ctx, payload: Partial<Notification>) {
      const n: Notification = {
        id: uid('ntf'),
        type: payload.type ?? 'INFO',
        title: payload.title ?? 'Notification',
        message: payload.message ?? '',
        timestamp: payload.timestamp ?? Date.now(),
      };
      commit('add', n);
      // Auto-dismiss after 5 seconds (feature 13).
      setTimeout(() => commit('remove', n.id), AUTO_DISMISS_MS);
    },
    dismiss({ commit }: Ctx, id: string) {
      commit('remove', id);
    },
  },
};
