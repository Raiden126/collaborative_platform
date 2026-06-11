import { WorkflowNode } from '@cwb/shared';

export type StepStatus = 'success' | 'failed' | 'skipped';
export type RunMode = 'simulate' | 'live';

/** Per-node result that feeds the visual simulator and the debugger. */
export interface ExecutionStep {
  nodeId: string;
  type: string;
  label?: string;
  status: StepStatus;
  startedAt: number;
  durationMs: number;
  /** Whatever the node produced (webhook → API response, email → message id, …). */
  output?: unknown;
  /** Why a node was skipped, or the failure message. */
  error?: string;
}

/** Shared state threaded through a single workflow run. */
export interface RunContext {
  mode: RunMode;
  /** The initial payload that kicked off the run (trigger node input). */
  trigger: Record<string, unknown>;
  /** Outputs keyed by node id, so downstream nodes can reference upstream results. */
  outputs: Record<string, unknown>;
}

/** What an executor returns. */
export interface NodeOutcome {
  output?: unknown;
  /**
   * For branching nodes (e.g. condition): the outbound handle id(s) to follow.
   * Omit to follow every outbound edge.
   */
  activate?: string[];
}

/** Contract every node type implements — the seam for the plugin architecture. */
export interface NodeExecutor {
  readonly type: string;
  execute(node: WorkflowNode, ctx: RunContext): Promise<NodeOutcome> | NodeOutcome;
}

/** Thrown by executors on failure; may carry partial output for the debugger. */
export class NodeExecutionError extends Error {
  constructor(
    message: string,
    public readonly output?: unknown,
  ) {
    super(message);
    this.name = 'NodeExecutionError';
  }
}
