import type { ActionContext, Module } from 'vuex';
import type { AnyWorkflowEvent, WorkflowGraph, XYPosition } from '@cwb/shared';
import { connectSocket, disconnectSocket, getSocket } from '@/realtime/socket';
import type { RootState } from '../types';

export interface PresenceUser {
  socketId: string;
  id: number;
  name: string;
  color: string;
}
export interface Cursor {
  userId: number;
  name: string;
  color: string;
  position: XYPosition;
  updatedAt: number;
}

export interface RealtimeState {
  connected: boolean;
  presence: PresenceUser[];
  cursors: Record<number, Cursor>;
}

type Ctx = ActionContext<RealtimeState, RootState>;

export const realtime: Module<RealtimeState, RootState> = {
  namespaced: true,
  state: (): RealtimeState => ({ connected: false, presence: [], cursors: {} }),
  getters: {
    collaborators: (s: RealtimeState, _g: unknown, root: RootState) =>
      s.presence.filter((p) => p.id !== root.auth.user?.id),
  },
  mutations: {
    setConnected(s: RealtimeState, v: boolean) {
      s.connected = v;
    },
    setPresence(s: RealtimeState, users: PresenceUser[]) {
      s.presence = users;
    },
    setCursor(s: RealtimeState, c: Cursor) {
      s.cursors = { ...s.cursors, [c.userId]: c };
    },
    reset(s: RealtimeState) {
      s.presence = [];
      s.cursors = {};
    },
  },
  actions: {
    // Wire socket lifecycle + inbound events to the store. Called once after login.
    connect({ commit, dispatch, rootState }: Ctx) {
      const socket = connectSocket();

      socket.on('connect', () => {
        commit('setConnected', true);
        // Re-join the active room and drain anything buffered in the outbox.
        if (rootState.workflow.activeId != null) {
          dispatch('join', rootState.workflow.activeId);
        }
        dispatch('offline/sync', undefined, { root: true });
      });
      socket.on('disconnect', () => {
        commit('setConnected', false);
        commit('reset');
      });

      socket.on('presence:update', (p: { users: PresenceUser[] }) => commit('setPresence', p.users));
      socket.on('cursor:update', (c: Omit<Cursor, 'updatedAt'>) =>
        commit('setCursor', { ...c, updatedAt: Date.now() }),
      );
      socket.on('workflow:event', (p: { events: AnyWorkflowEvent[] }) =>
        dispatch('workflow/applyRemoteEvents', p.events, { root: true }),
      );
      socket.on('workflow:graphReplaced', (p: { graph: WorkflowGraph }) =>
        dispatch('workflow/setGraph', p.graph, { root: true }),
      );
      socket.on('notification', (n: Record<string, unknown>) =>
        dispatch('notifications/push', n, { root: true }),
      );
    },
    join(_ctx: Ctx, workflowId: number) {
      getSocket()?.emit('workflow:join', { workflowId });
    },
    leave(_ctx: Ctx, workflowId: number) {
      getSocket()?.emit('workflow:leave', { workflowId });
    },
    /**
     * Send events to the server over the socket and AWAIT the server's ack.
     * The gateway persists them (via the shared reducer) and assigns the
     * authoritative seq before acking — so a resolved promise means "durably
     * stored". Throws on disconnect/timeout/rejection so the caller can retry.
     */
    async sendEvents(
      _ctx: Ctx,
      payload: { workflowId: number; events: AnyWorkflowEvent[] },
    ): Promise<{ ok: boolean; version?: number }> {
      const socket = getSocket();
      if (!socket || !socket.connected) throw new Error('socket disconnected');
      const ack = (await socket
        .timeout(8000)
        .emitWithAck('workflow:event', payload)) as { ok: boolean; version?: number };
      if (!ack?.ok) throw new Error('server rejected events');
      return ack;
    },
    moveCursor(_ctx: Ctx, payload: { workflowId: number; position: XYPosition }) {
      getSocket()?.emit('cursor:move', payload);
    },
    disconnect({ commit }: Ctx) {
      disconnectSocket();
      commit('setConnected', false);
      commit('reset');
    },
  },
};
