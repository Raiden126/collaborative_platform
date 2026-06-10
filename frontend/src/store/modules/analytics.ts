import type { ActionContext, Module } from 'vuex';
import { analyticsApi, type AnalyticsSummary } from '@/api';
import type { RootState } from '../types';

export interface AnalyticsState {
  summary: AnalyticsSummary | null;
  loading: boolean;
}

type Ctx = ActionContext<AnalyticsState, RootState>;

export const analytics: Module<AnalyticsState, RootState> = {
  namespaced: true,
  state: (): AnalyticsState => ({ summary: null, loading: false }),
  mutations: {
    setSummary(s: AnalyticsState, v: AnalyticsSummary) {
      s.summary = v;
    },
    setLoading(s: AnalyticsState, v: boolean) {
      s.loading = v;
    },
  },
  actions: {
    async load({ commit }: Ctx) {
      commit('setLoading', true);
      try {
        commit('setSummary', await analyticsApi.summary());
      } finally {
        commit('setLoading', false);
      }
    },
  },
};
