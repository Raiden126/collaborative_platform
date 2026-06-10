import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class ActivityService {
  constructor(private readonly prisma: PrismaService) {}

  record(input: {
    type: string;
    message: string;
    workflowId?: number | null;
    userId?: number | null;
    metadata?: Prisma.InputJsonValue;
  }) {
    return this.prisma.activity.create({
      data: {
        type: input.type,
        message: input.message,
        workflowId: input.workflowId ?? null,
        userId: input.userId ?? null,
        metadata: input.metadata ?? Prisma.JsonNull,
      },
    });
  }

  list(params: { workflowId?: number; take?: number }) {
    return this.prisma.activity.findMany({
      where: params.workflowId ? { workflowId: params.workflowId } : undefined,
      orderBy: { createdAt: 'desc' },
      take: params.take ?? 100,
      include: { user: { select: { id: true, name: true } } },
    });
  }
}
