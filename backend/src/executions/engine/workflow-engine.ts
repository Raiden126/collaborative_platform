import { Injectable } from '@nestjs/common';
import { WorkflowConnection, WorkflowGraph, WorkflowNode } from '@cwb/shared';
import { NodeExecutorRegistry } from './node-executor.registry';
import { ExecutionStep, NodeExecutionError, RunContext, RunMode } from './types';

export interface RunResult {
  status: 'SUCCESS' | 'FAILED';
  steps: ExecutionStep[];
  outputs: Record<string, unknown>;
}

export interface RunOptions {
  mode?: RunMode;
  trigger?: Record<string, unknown>;
}

/**
 * Executes a workflow graph for real: walks nodes in dependency order, threads
 * data between them, follows condition branches, runs each node's executor and
 * captures output / errors / timing for the simulator and debugger.
 *
 * Reachability rules:
 *  - entry nodes (no inbound edge) always run;
 *  - any other node runs only if ≥1 of its inbound edges is "active";
 *  - a node activates its outbound edges only when it succeeds (a condition
 *    activates just the matching true/false branch), so failures and untaken
 *    branches cascade into downstream nodes being "skipped".
 */
@Injectable()
export class WorkflowEngine {
  constructor(private readonly registry: NodeExecutorRegistry) {}

  async run(graph: WorkflowGraph, options: RunOptions = {}): Promise<RunResult> {
    const ctx: RunContext = {
      mode: options.mode ?? 'simulate',
      trigger: options.trigger ?? {},
      outputs: {},
    };

    const order = this.topologicalOrder(graph);
    const inbound = new Map<string, WorkflowConnection[]>();
    const outbound = new Map<string, WorkflowConnection[]>();
    for (const n of graph.nodes) {
      inbound.set(n.id, []);
      outbound.set(n.id, []);
    }
    for (const c of graph.connections) {
      outbound.get(c.source)?.push(c);
      inbound.get(c.target)?.push(c);
    }

    const activeEdges = new Set<string>();
    const steps: ExecutionStep[] = [];
    let failed = false;

    for (const node of order) {
      const incoming = inbound.get(node.id) ?? [];
      const isEntry = incoming.length === 0;
      const reached = isEntry || incoming.some((e) => activeEdges.has(e.id));

      if (!reached) {
        steps.push({
          nodeId: node.id,
          type: node.type,
          status: 'skipped',
          startedAt: 0,
          durationMs: 0,
          error: 'Upstream failed or branch not taken',
        });
        continue;
      }

      const start = Date.now();
      const executor = this.registry.get(node.type);
      try {
        const outcome = executor
          ? await executor.execute(node, ctx)
          : { output: { note: `No executor for "${node.type}"` } };
        ctx.outputs[node.id] = outcome.output;
        this.activateOutbound(outbound.get(node.id) ?? [], outcome.activate, activeEdges);
        steps.push({
          nodeId: node.id,
          type: node.type,
          status: 'success',
          startedAt: start,
          durationMs: Date.now() - start,
          output: outcome.output,
        });
      } catch (err) {
        failed = true;
        const output = err instanceof NodeExecutionError ? err.output : undefined;
        if (output !== undefined) ctx.outputs[node.id] = output;
        steps.push({
          nodeId: node.id,
          type: node.type,
          status: 'failed',
          startedAt: start,
          durationMs: Date.now() - start,
          output,
          error: (err as Error).message,
        });
        // Outbound edges stay inactive → downstream nodes get skipped.
      }
    }

    return { status: failed ? 'FAILED' : 'SUCCESS', steps, outputs: ctx.outputs };
  }

  private activateOutbound(
    edges: WorkflowConnection[],
    activate: string[] | undefined,
    activeEdges: Set<string>,
  ) {
    for (const e of edges) {
      if (!activate) {
        activeEdges.add(e.id);
        continue;
      }
      // Match the chosen handle against the edge's sourceHandle or label.
      const handle = e.sourceHandle ?? e.label ?? 'default';
      if (activate.includes(handle) || activate.includes('default')) activeEdges.add(e.id);
    }
  }

  /** Kahn topological sort; trigger nodes are preferred as starting points. */
  private topologicalOrder(graph: WorkflowGraph): WorkflowNode[] {
    const indegree = new Map<string, number>();
    const adj = new Map<string, string[]>();
    for (const n of graph.nodes) {
      indegree.set(n.id, 0);
      adj.set(n.id, []);
    }
    for (const c of graph.connections) {
      if (!adj.has(c.source) || !indegree.has(c.target)) continue;
      adj.get(c.source)!.push(c.target);
      indegree.set(c.target, (indegree.get(c.target) ?? 0) + 1);
    }
    const byId = new Map(graph.nodes.map((n) => [n.id, n]));
    const queue = graph.nodes
      .filter((n) => (indegree.get(n.id) ?? 0) === 0)
      .sort((a, b) => Number(b.type === 'trigger') - Number(a.type === 'trigger'))
      .map((n) => n.id);

    const orderedIds: string[] = [];
    const visited = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      orderedIds.push(id);
      for (const next of adj.get(id) ?? []) {
        indegree.set(next, (indegree.get(next) ?? 1) - 1);
        if ((indegree.get(next) ?? 0) <= 0) queue.push(next);
      }
    }
    const order = orderedIds.map((id) => byId.get(id)!);
    // Append unreachable / cyclic nodes so the debugger still lists them.
    for (const n of graph.nodes) if (!visited.has(n.id)) order.push(n);
    return order;
  }
}
