import type { ActionContext, Module } from 'vuex';
import { authApi, type AuthUser } from '@/api';
import { setAccessToken } from '@/api/http';
import type { RootState } from '../types';

export interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  status: 'idle' | 'loading' | 'authenticated' | 'error';
  error: string | null;
}

type Ctx = ActionContext<AuthState, RootState>;

export const auth: Module<AuthState, RootState> = {
  namespaced: true,
  state: (): AuthState => ({ user: null, accessToken: null, status: 'idle', error: null }),
  getters: {
    isAuthenticated: (s: AuthState) => !!s.user,
    permissions: (s: AuthState) => s.user?.permissions ?? [],
    roles: (s: AuthState) => s.user?.roles ?? [],
  },
  mutations: {
    setSession(s: AuthState, payload: { user: AuthUser; accessToken: string }) {
      s.user = payload.user;
      s.accessToken = payload.accessToken;
      s.status = 'authenticated';
      s.error = null;
      setAccessToken(payload.accessToken);
    },
    setStatus(s: AuthState, status: AuthState['status']) {
      s.status = status;
    },
    setError(s: AuthState, error: string | null) {
      s.error = error;
      if (error) s.status = 'error';
    },
    clear(s: AuthState) {
      s.user = null;
      s.accessToken = null;
      s.status = 'idle';
      setAccessToken(null);
    },
  },
  actions: {
    async login({ commit }: Ctx, payload: { email: string; password: string }) {
      commit('setStatus', 'loading');
      try {
        const data = await authApi.login(payload.email, payload.password);
        commit('setSession', data);
        return true;
      } catch (e: any) {
        commit('setError', e?.response?.data?.message ?? 'Login failed');
        return false;
      }
    },
    // Called on app boot — silently restores a session from the refresh cookie.
    async restore({ commit }: Ctx) {
      try {
        const data = await authApi.refresh();
        commit('setSession', data);
        return true;
      } catch {
        commit('clear');
        return false;
      }
    },
    async logout({ commit }: Ctx) {
      try {
        await authApi.logout();
      } finally {
        commit('clear');
      }
    },
  },
};
