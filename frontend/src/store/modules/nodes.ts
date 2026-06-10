import type { Module } from 'vuex';
import type { WorkflowGraph, WorkflowNode } from '@cwb/shared';
import type { RootState } from '../types';

/**
 * Normalized node store ({ byId, ids }) — feature 17 (store normalization).
 * This is a projection of the active workflow graph; mutations flow through the
 * workflow module's event pipeline, never directly, to keep event sourcing intact.
 */
export interface NodesState {
  byId: Record<string, WorkflowNode>;
  ids: string[];
  selectedId: string | null;
}

export const nodes: Module<NodesState, RootState> = {
  namespaced: true,
  state: (): NodesState => ({ byId: {}, ids: [], selectedId: null }),
  getters: {
    all: (s: NodesState): WorkflowNode[] => s.ids.map((id) => s.byId[id]),
    byId: (s: NodesState) => (id: string) => s.byId[id],
    selected: (s: NodesState): WorkflowNode | null =>
      s.selectedId ? s.byId[s.selectedId] ?? null : null,
    count: (s: NodesState) => s.ids.length,
  },
  mutations: {
    setFromGraph(s: NodesState, graph: WorkflowGraph) {
      s.byId = {};
      s.ids = [];
      for (const n of graph.nodes) {
        s.byId[n.id] = n;
        s.ids.push(n.id);
      }
    },
    select(s: NodesState, id: string | null) {
      s.selectedId = id;
    },
  },
};
