import type { Module } from 'vuex';
import type { WorkflowConnection, WorkflowGraph } from '@cwb/shared';
import type { RootState } from '../types';

export interface ConnectionsState {
  byId: Record<string, WorkflowConnection>;
  ids: string[];
}

export const connections: Module<ConnectionsState, RootState> = {
  namespaced: true,
  state: (): ConnectionsState => ({ byId: {}, ids: [] }),
  getters: {
    all: (s: ConnectionsState): WorkflowConnection[] => s.ids.map((id) => s.byId[id]),
    count: (s: ConnectionsState) => s.ids.length,
  },
  mutations: {
    setFromGraph(s: ConnectionsState, graph: WorkflowGraph) {
      s.byId = {};
      s.ids = [];
      for (const c of graph.connections) {
        s.byId[c.id] = c;
        s.ids.push(c.id);
      }
    },
  },
};
