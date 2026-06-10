import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { WorkflowGraph, emptyGraph } from '@cwb/shared';
import { PrismaService } from '../prisma/prisma.service';
import { ActivityService } from '../activity/activity.service';
import { RealtimeGateway } from '../realtime/realtime.gateway';
import { CreateWorkflowDto } from './dto/create-workflow.dto';
import { UpdateWorkflowDto } from './dto/update-workflow.dto';

@Injectable()
export class WorkflowsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly activity: ActivityService,
    private readonly realtime: RealtimeGateway,
  ) {}

  list() {
    return this.prisma.workflow.findMany({
      orderBy: { updatedAt: 'desc' },
      include: { owner: { select: { id: true, name: true } } },
    });
  }

  async get(id: number) {
    const workflow = await this.prisma.workflow.findUnique({ where: { id } });
    if (!workflow) throw new NotFoundException('Workflow not found');
    return workflow;
  }

  async create(dto: CreateWorkflowDto, userId: number) {
    const workflow = await this.prisma.workflow.create({
      data: {
        name: dto.name,
        description: dto.description,
        ownerId: userId,
        graph: emptyGraph() as object,
      },
    });
    // Seed version 1.
    await this.snapshotVersion(workflow.id, 'Initial version', userId);
    await this.activity.record({
      type: 'WORKFLOW_CREATED',
      message: `Created workflow "${workflow.name}"`,
      workflowId: workflow.id,
      userId,
    });
    this.realtime.emitNotification({
      type: 'WORKFLOW_CREATED',
      title: 'Workflow created',
      message: workflow.name,
      workflowId: workflow.id,
    });
    return workflow;
  }

  async update(id: number, dto: UpdateWorkflowDto, userId: number) {
    await this.get(id);
    const workflow = await this.prisma.workflow.update({
      where: { id },
      data: {
        name: dto.name,
        description: dto.description,
        graph: dto.graph ? (dto.graph as object) : undefined,
      },
    });
    await this.activity.record({
      type: 'WORKFLOW_UPDATED',
      message: `Updated workflow "${workflow.name}"`,
      workflowId: id,
      userId,
    });
    this.realtime.emitNotification({
      type: 'WORKFLOW_UPDATED',
      title: 'Workflow updated',
      message: workflow.name,
      workflowId: id,
    });
    return workflow;
  }

  async duplicate(id: number, userId: number) {
    const source = await this.get(id);
    const copy = await this.prisma.workflow.create({
      data: {
        name: `${source.name} (copy)`,
        description: source.description,
        graph: source.graph as object,
        ownerId: userId,
      },
    });
    await this.snapshotVersion(copy.id, `Duplicated from #${source.id}`, userId);
    await this.activity.record({
      type: 'WORKFLOW_DUPLICATED',
      message: `Duplicated "${source.name}"`,
      workflowId: copy.id,
      userId,
    });
    return copy;
  }

  async publish(id: number, userId: number) {
    const workflow = await this.get(id);
    if (workflow.status === 'ARCHIVED') {
      throw new ForbiddenException('Cannot publish an archived workflow');
    }
    const published = await this.prisma.workflow.update({
      where: { id },
      data: { status: 'PUBLISHED' },
    });
    await this.snapshotVersion(id, 'Published', userId);
    await this.activity.record({
      type: 'WORKFLOW_PUBLISHED',
      message: `Published "${workflow.name}"`,
      workflowId: id,
      userId,
    });
    this.realtime.emitNotification({
      type: 'WORKFLOW_PUBLISHED',
      title: 'Workflow published',
      message: workflow.name,
      workflowId: id,
    });
    return published;
  }

  async remove(id: number, userId: number) {
    const workflow = await this.get(id);
    await this.prisma.workflow.delete({ where: { id } });
    await this.activity.record({
      type: 'WORKFLOW_DELETED',
      message: `Deleted "${workflow.name}"`,
      userId,
    });
    return { success: true };
  }

  // --- Versioning ------------------------------------------------------------

  listVersions(id: number) {
    return this.prisma.workflowVersion.findMany({
      where: { workflowId: id },
      orderBy: { version: 'desc' },
    });
  }

  getVersion(id: number, version: number) {
    return this.prisma.workflowVersion.findUnique({
      where: { workflowId_version: { workflowId: id, version } },
    });
  }

  async snapshotVersion(id: number, message: string | undefined, userId: number) {
    const workflow = await this.get(id);
    const last = await this.prisma.workflowVersion.findFirst({
      where: { workflowId: id },
      orderBy: { version: 'desc' },
      select: { version: true },
    });
    const version = (last?.version ?? 0) + 1;
    return this.prisma.workflowVersion.create({
      data: {
        workflowId: id,
        version,
        name: workflow.name,
        graph: workflow.graph as object,
        message,
        createdById: userId,
      },
    });
  }

  /** Restore a prior version's graph as the current graph (records a new version). */
  async restoreVersion(id: number, version: number, userId: number) {
    const snapshot = await this.getVersion(id, version);
    if (!snapshot) throw new NotFoundException('Version not found');
    const restored = await this.prisma.workflow.update({
      where: { id },
      data: { graph: snapshot.graph as object },
    });
    await this.snapshotVersion(id, `Restored from v${version}`, userId);
    await this.activity.record({
      type: 'WORKFLOW_RESTORED',
      message: `Restored "${restored.name}" to v${version}`,
      workflowId: id,
      userId,
    });
    // Push the restored graph to any collaborators on the canvas.
    this.realtime.emitGraphReplaced(id, restored.graph as unknown as WorkflowGraph);
    return restored;
  }

  /** Return two version graphs so the client can render a diff. */
  async compareVersions(id: number, a: number, b: number) {
    const [from, to] = await Promise.all([this.getVersion(id, a), this.getVersion(id, b)]);
    if (!from || !to) throw new NotFoundException('Version not found');
    return { from, to };
  }
}
