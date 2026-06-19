import {
  WorkflowConnection,
  WorkflowGraph,
  WorkflowNode,
  XYPosition,
  emptyGraph,
} from './workflow';

/**
 * Event-sourced workflow mutations. The current graph is always reproducible by
 * folding an ordered event stream from the empty graph (see `replay`).
 *
 * This same reducer powers:
 *   - backend persistence (append-only WorkflowEvent rows)
 *   - frontend undo/redo (past/present/future of events)
 *   - time-travel debugging (replay up to seq N)
 *   - offline sync (queued events flushed on reconnect)
 */
export type WorkflowEventType =
  | 'NODE_CREATED'
  | 'NODE_UPDATED'
  | 'NODE_MOVED'
  | 'NODE_DELETED'
  | 'CONNECTION_ADDED'
  | 'CONNECTION_REMOVED'
  | 'WORKFLOW_RENAMED'
  | 'GRAPH_REPLACED';

export interface WorkflowEventPayloadMap {
  NODE_CREATED: { node: WorkflowNode };
  NODE_UPDATED: { nodeId: string; data: Record<string, unknown> };
  NODE_MOVED: { nodeId: string; position: XYPosition };
  NODE_DELETED: { nodeId: string };
  CONNECTION_ADDED: { connection: WorkflowConnection };
  CONNECTION_REMOVED: { connectionId: string };
  WORKFLOW_RENAMED: { name: string };
  GRAPH_REPLACED: { graph: WorkflowGraph };
}

export interface WorkflowEvent<T extends WorkflowEventType = WorkflowEventType> {
  type: T;
  payload: WorkflowEventPayloadMap[T];
  /** Per-workflow monotonic sequence (assigned by the server). */
  seq?: number;
  /** Client-generated id for de-duplication / offline reconciliation. */
  clientId?: string;
  userId?: number | null;
  /** ms epoch — used by Last-Write-Wins conflict resolution. */
  timestamp?: number;
}

export type AnyWorkflowEvent = WorkflowEvent<WorkflowEventType>;

/** Pure reducer: apply a single event to a graph, returning a new graph. */
export function applyEvent(graph: WorkflowGraph, event: AnyWorkflowEvent): WorkflowGraph {
  switch (event.type) {
    case 'NODE_CREATED': {
      const { node } = event.payload as WorkflowEventPayloadMap['NODE_CREATED'];
      if (graph.nodes.some((n) => n.id === node.id)) return graph;
      return { ...graph, nodes: [...graph.nodes, node] };
    }
    case 'NODE_UPDATED': {
      const { nodeId, data } = event.payload as WorkflowEventPayloadMap['NODE_UPDATED'];
      return {
        ...graph,
        nodes: graph.nodes.map((n) =>
          n.id === nodeId ? { ...n, data: { ...n.data, ...data } } : n,
        ),
      };
    }
    case 'NODE_MOVED': {
      const { nodeId, position } = event.payload as WorkflowEventPayloadMap['NODE_MOVED'];
      return {
        ...graph,
        nodes: graph.nodes.map((n) => (n.id === nodeId ? { ...n, position } : n)),
      };
    }
    case 'NODE_DELETED': {
      const { nodeId } = event.payload as WorkflowEventPayloadMap['NODE_DELETED'];
      return {
        nodes: graph.nodes.filter((n) => n.id !== nodeId),
        // Drop dangling connections too.
        connections: graph.connections.filter((c) => c.source !== nodeId && c.target !== nodeId),
      };
    }
    case 'CONNECTION_ADDED': {
      const { connection } = event.payload as WorkflowEventPayloadMap['CONNECTION_ADDED'];
      if (graph.connections.some((c) => c.id === connection.id)) return graph;
      return { ...graph, connections: [...graph.connections, connection] };
    }
    case 'CONNECTION_REMOVED': {
      const { connectionId } = event.payload as WorkflowEventPayloadMap['CONNECTION_REMOVED'];

      return {
        ...graph,
        connections: graph.connections.filter((c) => c.id !== connectionId),
      };
    }
    case 'GRAPH_REPLACED': {
      const { graph: next } = event.payload as WorkflowEventPayloadMap['GRAPH_REPLACED'];
      return { nodes: [...next.nodes], connections: [...next.connections] };
    }
    case 'WORKFLOW_RENAMED':
      // Name lives on the workflow record, not the graph; no graph change.
      return graph;
    default:
      return graph;
  }
}

/** Fold an ordered event stream into a materialized graph. */
export function replay(
  events: AnyWorkflowEvent[],
  initial: WorkflowGraph = emptyGraph(),
): WorkflowGraph {
  return events.reduce((g, e) => applyEvent(g, e), initial);
}

/** Helper to build a well-formed event with a timestamp. */
export function makeEvent<T extends WorkflowEventType>(
  type: T,
  payload: WorkflowEventPayloadMap[T],
  meta: Partial<Pick<WorkflowEvent<T>, 'clientId' | 'userId' | 'timestamp'>> = {},
): WorkflowEvent<T> {
  return { type, payload, ...meta };
}
