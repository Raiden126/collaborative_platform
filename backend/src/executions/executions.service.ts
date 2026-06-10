import { Injectable, NotFoundException } from '@nestjs/common';
import { WorkflowGraph, WorkflowNode } from '@cwb/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';

export type StepStatus = 'success' | 'failed' | 'skipped';

export interface ExecutionStep {
  nodeId: string;
  type: string;
  status: StepStatus;
  durationMs: number;
  startedAt: number;
  output?: unknown;
  error?: string;
}

/**
 * Lightweight workflow simulator. Walks the graph from trigger nodes following
 * connections, producing per-node step results that feed the visual simulator
 * and the debugger. Node behaviour can be scripted via `node.data._sim`:
 *   { fail?: boolean, skip?: boolean, durationMs?: number, output?: unknown }
 */
@Injectable()
export class ExecutionsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly realtime: RealtimeGateway,
  ) {}

  async simulate(workflowId: number, userId?: number) {
    console.log('running')
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    const graph = workflow.graph as unknown as WorkflowGraph;

    const order = this.topologicalOrder(graph);
    const steps: ExecutionStep[] = [];
    let failed = false;

    let clock = 0;
    for (const node of order) {
      const sim = (node.data?._sim ?? {}) as {
        fail?: boolean;
        skip?: boolean;
        durationMs?: number;
        output?: unknown;
      };
      const durationMs = sim.durationMs ?? 20 + Math.floor(Math.random() * 80);
      const startedAt = clock;
      clock += durationMs;

      // Once a node fails, downstream nodes are skipped.
      if (failed || sim.skip) {
        steps.push({ nodeId: node.id, type: node.type, status: 'skipped', durationMs: 0, startedAt });
        continue;
      }
      if (sim.fail) {
        failed = true;
        steps.push({
          nodeId: node.id,
          type: node.type,
          status: 'failed',
          durationMs,
          startedAt,
          error: (sim.output as string) ?? 'Simulated failure',
        });
        continue;
      }
      steps.push({
        nodeId: node.id,
        type: node.type,
        status: 'success',
        durationMs,
        startedAt,
        output: sim.output ?? { ok: true },
      });
    }

    const execution = await this.prisma.execution.create({
      data: {
        workflowId,
        status: failed ? 'FAILED' : 'SUCCESS',
        steps: steps as object,
        finishedAt: new Date(),
      },
    });

    await this.activity.record({
      type: failed ? 'EXECUTION_FAILED' : 'EXECUTION_SUCCEEDED',
      message: `Simulated "${workflow.name}" — ${failed ? 'failed' : 'succeeded'}`,
      workflowId,
      userId,
    });

    if (failed) {
      this.realtime.emitNotification({
        type: 'WORKFLOW_FAILED',
        title: 'Workflow failed',
        message: workflow.name,
        workflowId,
      });
    }
    console.log('running complete')

    return { execution, steps, status: failed ? 'FAILED' : 'SUCCESS' };
  }

  listExecutions(workflowId: number) {
    return this.prisma.execution.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }

  /** Kahn topological sort; entry points are trigger nodes / nodes with no inbound edges. */
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
      .sort((a, b) => (a.type === 'trigger' ? -1 : 1) - (b.type === 'trigger' ? -1 : 1))
      .map((n) => n.id);

    const order: WorkflowNode[] = [];
    const visited = new Set<string>();
    while (queue.length) {
      const id = queue.shift()!;
      if (visited.has(id)) continue;
      visited.add(id);
      order.push(byId.get(id)!);
      for (const next of adj.get(id) ?? []) {
        indegree.set(next, (indegree.get(next) ?? 1) - 1);
        if ((indegree.get(next) ?? 0) <= 0) queue.push(next);
      }
    }
    // Append any nodes in cycles / unreachable so the debugger still lists them.
    for (const n of graph.nodes) if (!visited.has(n.id)) order.push(n);
    return order;
  }
}
