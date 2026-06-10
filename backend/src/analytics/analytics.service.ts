import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class AnalyticsService {
  constructor(private readonly prisma: PrismaService) {}

  async summary() {
    const [totalWorkflows, activeWorkflows, executions] = await Promise.all([
      this.prisma.workflow.count(),
      this.prisma.workflow.count({ where: { status: 'PUBLISHED' } }),
      this.prisma.execution.findMany({
        select: { status: true, startedAt: true },
        orderBy: { startedAt: 'desc' },
        take: 1000,
      }),
    ]);

    const failed = executions.filter((e) => e.status === 'FAILED').length;
    const succeeded = executions.filter((e) => e.status === 'SUCCESS').length;
    const finished = failed + succeeded;
    const successRate = finished === 0 ? 0 : Math.round((succeeded / finished) * 100);

    // Daily execution trend (last 14 days).
    const trend = this.buildTrend(executions);

    return {
      totalWorkflows,
      activeWorkflows,
      failedExecutions: failed,
      successfulExecutions: succeeded,
      successRate,
      trend,
    };
  }

  private buildTrend(executions: { status: string; startedAt: Date }[]) {
    const days = 14;
    const buckets = new Map<string, { success: number; failed: number }>();
    const now = new Date();
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now);
      d.setDate(now.getDate() - i);
      buckets.set(d.toISOString().slice(0, 10), { success: 0, failed: 0 });
    }
    for (const e of executions) {
      const key = e.startedAt.toISOString().slice(0, 10);
      const bucket = buckets.get(key);
      if (!bucket) continue;
      if (e.status === 'FAILED') bucket.failed += 1;
      else if (e.status === 'SUCCESS') bucket.success += 1;
    }
    return [...buckets.entries()].map(([date, v]) => ({ date, ...v }));
  }
}
