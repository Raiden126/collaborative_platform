import type { ActionContext, Module } from 'vuex';
import {
  applyEvent,
  emptyGraph,
  makeEvent,
  type AnyWorkflowEvent,
  type Workflow,
  type WorkflowGraph,
} from '@cwb/shared';
import { workflowsApi } from '@/api';
import { uid } from '@/utils/id';
import type { RootState } from '../types';

const HISTORY_LIMIT = 100;

export interface WorkflowState {
  // Normalized workflow list (feature 17).
  byId: Record<number, Workflow>;
  ids: number[];
  activeId: number | null;
  meta: { name: string; status: string; version: number } | null;
  // Undo/redo over graph snapshots: { past, present(=live graph), future } (feature 9).
  past: WorkflowGraph[];
  future: WorkflowGraph[];
  loading: boolean;
}

type Ctx = ActionContext<WorkflowState, RootState>;

function readGraph(root: RootState): WorkflowGraph {
  return {
    nodes: root.nodes.ids.map((id) => root.nodes.byId[id]),
    connections: root.connections.ids.map((id) => root.connections.byId[id]),
  };
}

export const workflow: Module<WorkflowState, RootState> = {
  namespaced: true,
  state: (): WorkflowState => ({
    byId: {},
    ids: [],
    activeId: null,
    meta: null,
    past: [],
    future: [],
    loading: false,
  }),
  getters: {
    list: (s: WorkflowState): Workflow[] => s.ids.map((id) => s.byId[id]),
    active: (s: WorkflowState): Workflow | null => (s.activeId ? s.byId[s.activeId] ?? null : null),
    currentGraph: (_s: WorkflowState, _g: unknown, root: RootState): WorkflowGraph => readGraph(root),
    canUndo: (s: WorkflowState) => s.past.length > 0,
    canRedo: (s: WorkflowState) => s.future.length > 0,
  },
  mutations: {
    setList(s: WorkflowState, items: Workflow[]) {
      s.byId = {};
      s.ids = [];
      for (const w of items) {
        s.byId[w.id] = w;
        s.ids.push(w.id);
      }
    },
    upsert(s: WorkflowState, w: Workflow) {
      if (!s.byId[w.id]) s.ids.unshift(w.id);
      s.byId[w.id] = w;
    },
    remove(s: WorkflowState, id: number) {
      delete s.byId[id];
      s.ids = s.ids.filter((x) => x !== id);
    },
    setActive(s: WorkflowState, payload: { id: number; meta: WorkflowState['meta'] }) {
      s.activeId = payload.id;
      s.meta = payload.meta;
      s.past = [];
      s.future = [];
    },
    pushHistory(s: WorkflowState, snapshot: WorkflowGraph) {
      s.past.push(snapshot);
      if (s.past.length > HISTORY_LIMIT) s.past.shift();
      s.future = [];
    },
    setPast(s: WorkflowState, v: WorkflowGraph[]) {
      s.past = v;
    },
    setFuture(s: WorkflowState, v: WorkflowGraph[]) {
      s.future = v;
    },
    setLoading(s: WorkflowState, v: boolean) {
      s.loading = v;
    },
    rename(s: WorkflowState, name: string) {
      if (s.meta) s.meta.name = name;
    },
  },
  actions: {
    async loadList({ commit }: Ctx) {
      commit('setLoading', true);
      try {
        commit('setList', await workflowsApi.list());
      } finally {
        commit('setLoading', false);
      }
    },
    async create({ commit }: Ctx, payload: { name: string; description?: string }) {
      const w = await workflowsApi.create(payload);
      commit('upsert', w);
      return w;
    },
    async duplicate({ commit }: Ctx, id: number) {
      const w = await workflowsApi.duplicate(id);
      commit('upsert', w);
      return w;
    },
    async publish({ commit }: Ctx, id: number) {
      const w = await workflowsApi.publish(id);
      commit('upsert', w);
      return w;
    },
    async removeWorkflow({ commit }: Ctx, id: number) {
      await workflowsApi.remove(id);
      commit('remove', id);
    },

    // Open a workflow into the canvas: hydrate normalized stores + join realtime room.
    async open({ commit, dispatch }: Ctx, id: number) {
      const w = await workflowsApi.get(id);
      commit('upsert', w);
      const graph = (w.graph as WorkflowGraph) ?? emptyGraph();
      commit('nodes/setFromGraph', graph, { root: true });
      commit('connections/setFromGraph', graph, { root: true });
      commit('setActive', { id, meta: { name: w.name, status: w.status, version: w.version } });
      dispatch('realtime/join', id, { root: true });
    },

    setGraph({ commit }: Ctx, graph: WorkflowGraph) {
      commit('nodes/setFromGraph', graph, { root: true });
      commit('connections/setFromGraph', graph, { root: true });
    },

    /**
     * The heart of the client: apply a locally-initiated event.
     * Snapshots current graph for undo, folds the event via the shared reducer,
     * writes the projection back, then routes the event to realtime (or offline queue).
     */
    async commitEvent({ commit, dispatch, getters, rootState }: Ctx, raw: AnyWorkflowEvent) {
      const before = getters.currentGraph as WorkflowGraph;
      const event: AnyWorkflowEvent = { clientId: uid('evt'), timestamp: Date.now(), ...raw };
      const after = applyEvent(before, event);
      // 1) Apply optimistically so the canvas feels instant.
      commit('pushHistory', before);
      dispatch('setGraph', after);

      const id = rootState.workflow.activeId;
      if (id == null) return;
      // 2) Durability: write to the outbox, then sync to the server (socket-with-ack
      //    when connected, HTTP otherwise). The SERVER is authoritative — it folds
      //    the event with the shared reducer, persists it + the graph snapshot, and
      //    broadcasts to collaborators. We never PUT the whole graph for an edit.
      await dispatch('offline/enqueue', { workflowId: id, event }, { root: true });
      dispatch('offline/sync', undefined, { root: true });
    },

    // Apply events received from collaborators / server — not added to local undo stack.
    applyRemoteEvents({ getters, dispatch }: Ctx, events: AnyWorkflowEvent[]) {
      let graph = getters.currentGraph as WorkflowGraph;
      for (const e of events) graph = applyEvent(graph, e);
      dispatch('setGraph', graph);
    },

    undo({ state, getters, commit, dispatch }: Ctx) {
      if (!state.past.length) return;
      const present = getters.currentGraph as WorkflowGraph;
      const past = [...state.past];
      const previous = past.pop()!;
      commit('setPast', past);
      commit('setFuture', [present, ...state.future]);
      dispatch('setGraph', previous);
      dispatch('persistSnapshot', previous);
    },
    redo({ state, getters, commit, dispatch }: Ctx) {
      if (!state.future.length) return;
      const present = getters.currentGraph as WorkflowGraph;
      const future = [...state.future];
      const next = future.shift()!;
      commit('setFuture', future);
      commit('setPast', [...state.past, present]);
      dispatch('setGraph', next);
      dispatch('persistSnapshot', next);
    },

    // Undo/redo replace the whole graph — persist it through the SAME event
    // pipeline (a GRAPH_REPLACED event) so it's recorded in the event log and
    // broadcast to collaborators, rather than silently PUT-ing the graph.
    async persistSnapshot({ dispatch, rootState }: Ctx, graph: WorkflowGraph) {
      const id = rootState.workflow.activeId;
      if (id == null) return;
      const event = makeEvent(
        'GRAPH_REPLACED',
        { graph },
        { clientId: uid('evt'), timestamp: Date.now() },
      );
      await dispatch('offline/enqueue', { workflowId: id, event }, { root: true });
      dispatch('offline/sync', undefined, { root: true });
    },
  },
};
