import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { WorkflowGraph } from '@cwb/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { WorkflowEngine } from './engine/workflow-engine';
import { RunMode } from './engine/types';

// Re-exported for consumers that imported step types from here previously.
export type { ExecutionStep, StepStatus } from './engine/types';

@Injectable()
export class ExecutionsService {
  private readonly logger = new Logger(ExecutionsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly realtime: RealtimeGateway,
    private readonly engine: WorkflowEngine,
  ) {}

  /**
   * Run a workflow through the execution engine. Each node's executor actually
   * does its job (condition branching, real webhook calls, email/SMS via the
   * configured transports, …); the per-node results feed the simulator/debugger.
   */
  async simulate(
    workflowId: number,
    userId?: number,
    opts: { mode?: RunMode; trigger?: Record<string, unknown> } = {},
  ) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id: workflowId } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    const graph = workflow.graph as unknown as WorkflowGraph;

    const result = await this.engine.run(graph, {
      mode: opts.mode ?? 'simulate',
      trigger: opts.trigger ?? {},
    });
    const failed = result.status === 'FAILED';

    const execution = await this.prisma.execution.create({
      data: {
        workflowId,
        status: result.status,
        steps: result.steps as object,
        finishedAt: new Date(),
      },
    });

    await this.activity.record({
      type: failed ? 'EXECUTION_FAILED' : 'EXECUTION_SUCCEEDED',
      message: `Ran "${workflow.name}" — ${failed ? 'failed' : 'succeeded'}`,
      workflowId,
      userId,
      metadata: { executionId: execution.id, steps: result.steps.length },
    });

    if (failed) {
      const firstError = result.steps.find((s) => s.status === 'failed')?.error;
      this.realtime.emitNotification({
        type: 'WORKFLOW_FAILED',
        title: 'Workflow failed',
        message: firstError ? `${workflow.name}: ${firstError}` : workflow.name,
        workflowId,
      });
    }

    this.logger.log(`Executed workflow #${workflowId} → ${result.status}`);
    return { execution, steps: result.steps, status: result.status, outputs: result.outputs };
  }

  listExecutions(workflowId: number) {
    return this.prisma.execution.findMany({
      where: { workflowId },
      orderBy: { startedAt: 'desc' },
      take: 50,
    });
  }
}
