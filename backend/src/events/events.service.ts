import { Injectable, NotFoundException } from '@nestjs/common';
import { AnyWorkflowEvent, WorkflowGraph, applyEvent, emptyGraph, replay } from '@cwb/shared';
import { PrismaService } from '../prisma/prisma.service';

export interface AppendedEvent extends AnyWorkflowEvent {
  seq: number;
}

@Injectable()
export class EventsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Append a batch of events to a workflow's stream and re-materialize the
   * graph snapshot. Events are applied in arrival order — this is the
   * server-side Last-Write-Wins resolution for concurrent edits.
   */
  async append(
    workflowId: number,
    events: AnyWorkflowEvent[],
    userId?: number,
  ): Promise<{ events: AppendedEvent[]; graph: WorkflowGraph; version: number }> {
    return this.prisma.$transaction(async (tx) => {
      const workflow = await tx.workflow.findUnique({ where: { id: workflowId } });
      if (!workflow) throw new NotFoundException('Workflow not found');

      const last = await tx.workflowEvent.findFirst({
        where: { workflowId },
        orderBy: { seq: 'desc' },
        select: { seq: true },
      });

      let seq = last?.seq ?? 0;
      let graph = workflow.graph as unknown as WorkflowGraph;
      const appended: AppendedEvent[] = [];

      for (const event of events) {
        seq += 1;
        graph = applyEvent(graph, event);
        const stored: AppendedEvent = {
          ...event,
          seq,
          userId: userId ?? event.userId ?? null,
          timestamp: event.timestamp ?? Date.now(),
        };
        appended.push(stored);
        await tx.workflowEvent.create({
          data: {
            workflowId,
            seq,
            type: event.type,
            payload: event.payload as object,
            userId: userId ?? event.userId ?? null,
          },
        });
      }

      const updated = await tx.workflow.update({
        where: { id: workflowId },
        data: { graph: graph as object, version: { increment: 1 } },
      });

      return { events: appended, graph, version: updated.version };
    });
  }

  list(workflowId: number, afterSeq = 0) {
    return this.prisma.workflowEvent.findMany({
      where: { workflowId, seq: { gt: afterSeq } },
      orderBy: { seq: 'asc' },
    });
  }

  /** Materialize the graph as it existed at (or before) a given sequence — time travel. */
  async stateAt(workflowId: number, seq: number): Promise<WorkflowGraph> {
    const events = await this.prisma.workflowEvent.findMany({
      where: { workflowId, seq: { lte: seq } },
      orderBy: { seq: 'asc' },
    });
    return replay(
      events.map((e) => ({ type: e.type as AnyWorkflowEvent['type'], payload: e.payload as never })),
      emptyGraph(),
    );
  }
}
