import type { ActionContext, Module } from 'vuex';
import type { WorkflowGraph } from '@cwb/shared';
import { eventsApi, executionsApi, type ExecutionStep } from '@/api';
import type { RootState } from '../types';

export interface DebuggerState {
  steps: ExecutionStep[];
  currentStep: number; // index for step-by-step playback / node highlighting
  status: 'idle' | 'running' | 'SUCCESS' | 'FAILED';
  // Time-travel: list of (seq, type) for the active workflow's event stream.
  timeline: { seq: number; type: string; createdAt: string }[];
}

type Ctx = ActionContext<DebuggerState, RootState>;

export const debuggerModule: Module<DebuggerState, RootState> = {
  namespaced: true,
  state: (): DebuggerState => ({ steps: [], currentStep: -1, status: 'idle', timeline: [] }),
  getters: {
    activeNodeId: (s: DebuggerState): string | null =>
      s.currentStep >= 0 && s.currentStep < s.steps.length ? s.steps[s.currentStep].nodeId : null,
    failedNodes: (s: DebuggerState) => s.steps.filter((x) => x.status === 'failed'),
    skippedNodes: (s: DebuggerState) => s.steps.filter((x) => x.status === 'skipped'),
    totalDurationMs: (s: DebuggerState) => s.steps.reduce((a, x) => a + x.durationMs, 0),
  },
  mutations: {
    setSteps(s: DebuggerState, steps: ExecutionStep[]) {
      s.steps = steps;
      s.currentStep = -1;
    },
    setStatus(s: DebuggerState, status: DebuggerState['status']) {
      s.status = status;
    },
    setCurrentStep(s: DebuggerState, i: number) {
      s.currentStep = i;
    },
    setTimeline(s: DebuggerState, t: DebuggerState['timeline']) {
      s.timeline = t;
    },
  },
  actions: {
    async simulate({ commit, rootState }: Ctx) {
      const id = rootState.workflow.activeId;
      if (id == null) return;
      commit('setStatus', 'running');
      const res = await executionsApi.simulate(id);
      commit('setSteps', res.steps);
      commit('setStatus', res.status);
      return res;
    },
    // Step-by-step playback (feature 10: node highlighting).
    stepForward({ state, commit }: Ctx) {
      if (state.currentStep < state.steps.length - 1)
        commit('setCurrentStep', state.currentStep + 1);
    },
    stepBack({ state, commit }: Ctx) {
      if (state.currentStep > -1) commit('setCurrentStep', state.currentStep - 1);
    },
    reset({ commit }: Ctx) {
      commit('setCurrentStep', -1);
    },

    // --- Time-travel debugging (feature 19) ---
    async loadTimeline({ commit, rootState }: Ctx) {
      const id = rootState.workflow.activeId;
      if (id == null) return;
      const events = await eventsApi.list(id);
      commit(
        'setTimeline',
        events.map((e) => ({ seq: e.seq, type: e.type, createdAt: e.createdAt })),
      );
    },
    // Jump the canvas to the materialized state at a given sequence.
    async jumpTo({ dispatch, rootState }: Ctx, seq: number): Promise<WorkflowGraph | void> {
      const id = rootState.workflow.activeId;
      if (id == null) return;
      const graph = await eventsApi.stateAt(id, seq);
      dispatch('workflow/setGraph', graph, { root: true });
      return graph;
    },
  },
};
