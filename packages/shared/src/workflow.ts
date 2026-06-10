/** Built-in node categories. Plugins may register additional types at runtime. */
export type NodeType =
  | 'trigger'
  | 'condition'
  | 'action'
  | 'delay'
  | 'webhook'
  | 'email'
  | 'sms';

export interface XYPosition {
  x: number;
  y: number;
}

export interface WorkflowNode {
  id: string;
  type: string; // NodeType | plugin-provided type
  position: XYPosition;
  /** Arbitrary node configuration, validated by the dynamic form engine. */
  data: Record<string, unknown>;
}

export interface WorkflowConnection {
  id: string;
  source: string; // source node id
  target: string; // target node id
  sourceHandle?: string;
  targetHandle?: string;
  label?: string;
}

export interface WorkflowGraph {
  nodes: WorkflowNode[];
  connections: WorkflowConnection[];
}

export type WorkflowStatus = 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';

export interface Workflow {
  id: number;
  name: string;
  description?: string | null;
  status: WorkflowStatus;
  graph: WorkflowGraph;
  version: number;
  ownerId: number;
  createdAt: string;
  updatedAt: string;
}

export const emptyGraph = (): WorkflowGraph => ({ nodes: [], connections: [] });
