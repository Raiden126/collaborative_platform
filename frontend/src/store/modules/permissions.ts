import type { ActionContext, Module } from 'vuex';
import { permissionsApi } from '@/api';
import type { RootState } from '../types';

export interface PermissionsState {
  catalogue: string[];
}

type Ctx = ActionContext<PermissionsState, RootState>;

export const permissions: Module<PermissionsState, RootState> = {
  namespaced: true,
  state: (): PermissionsState => ({ catalogue: [] }),
  getters: {
    // The single source of truth for UI gating — reads the authenticated user's grants.
    has:
      (_s: PermissionsState, _g: unknown, root: RootState) =>
      (key: string) =>
        (root.auth.user?.permissions ?? []).includes(key),
    hasAny:
      (_s: PermissionsState, _g: unknown, root: RootState) =>
      (keys: string[]) => {
        const granted = new Set(root.auth.user?.permissions ?? []);
        return keys.some((k) => granted.has(k));
      },
  },
  mutations: {
    setCatalogue(s: PermissionsState, keys: string[]) {
      s.catalogue = keys;
    },
  },
  actions: {
    async loadCatalogue({ commit }: Ctx) {
      try {
        const items = await permissionsApi.catalogue();
        commit(
          'setCatalogue',
          items.map((i) => i.key),
        );
      } catch {
        /* non-fatal */
      }
    },
  },
};
