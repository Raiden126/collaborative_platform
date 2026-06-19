import type { Module } from 'vuex';
import type { WorkflowGraph, WorkflowConnection } from '@cwb/shared';
import type { RootState } from '../types';

export interface ConnectionsState {
  byId: Record<string, WorkflowConnection>;
  ids: string[];
}

export const connections: Module<ConnectionsState, RootState> = {
  namespaced: true,
  state: (): ConnectionsState => ({ byId: {}, ids: [] }),
  getters: {
    all: (s): WorkflowConnection[] => s.ids.map((id) => s.byId[id]),
    byId: (s) => (id: string) => s.byId[id],
    count: (s) => s.ids.length,
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
    add(s: ConnectionsState, connection: WorkflowConnection) {
      if (s.byId[connection.id]) return; // idempotent
      s.byId[connection.id] = connection;
      s.ids.push(connection.id);
    },
    // ── NEW ────────────────────────────────────────────────────────────────
    remove(s: ConnectionsState, connectionId: string) {
      if (!s.byId[connectionId]) return;
      delete s.byId[connectionId];
      s.ids = s.ids.filter((id) => id !== connectionId);
    },
  },
};