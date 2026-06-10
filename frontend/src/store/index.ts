import { createStore, useStore as baseUseStore, type Store } from 'vuex';
import type { InjectionKey } from 'vue';
import type { RootState } from './types';
import { auth } from './modules/auth';
import { permissions } from './modules/permissions';
import { workflow } from './modules/workflow';
import { nodes } from './modules/nodes';
import { connections } from './modules/connections';
import { notifications } from './modules/notifications';
import { realtime } from './modules/realtime';
import { debuggerModule } from './modules/debugger';
import { analytics } from './modules/analytics';
import { offline } from './modules/offline';

export const key: InjectionKey<Store<RootState>> = Symbol('store');

/** Factory — used by the app (singleton below) and by unit tests (fresh instances). */
export function createAppStore(): Store<RootState> {
  return createStore<RootState>({
    modules: {
      auth,
      permissions,
      workflow,
      nodes,
      connections,
      notifications,
      realtime,
      debugger: debuggerModule,
      analytics,
      offline,
    },
  });
}

export const store = createAppStore();

export function useStore(): Store<RootState> {
  return baseUseStore(key);
}
