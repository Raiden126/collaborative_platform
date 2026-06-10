import { Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { AnyWorkflowEvent, WorkflowGraph, XYPosition } from '@cwb/shared';
import { UsersService } from '../users/users.service';
import { EventsService } from '../events/events.service';
import { JwtPayload } from '../auth/auth.types';

interface PresenceUser {
  socketId: string;
  id: number;
  name: string;
  // Stable per-user color for cursors/avatars (derived from id).
  color: string;
}

const COLORS = ['#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#ec4899', '#14b8a6'];
const room = (workflowId: number) => `workflow:${workflowId}`;

@WebSocketGateway({
  namespace: '/realtime',
  cors: { origin: (process.env.CORS_ORIGIN ?? 'http://localhost:5173').split(','), credentials: true },
})
export class RealtimeGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer() server!: Server;
  private readonly logger = new Logger(RealtimeGateway.name);

  // workflowId -> (socketId -> presence)
  private presence = new Map<number, Map<string, PresenceUser>>();

  constructor(
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly users: UsersService,
    private readonly events: EventsService,
  ) {}

  async handleConnection(client: Socket) {
    try {
      const token = client.handshake.auth?.token as string | undefined;
      if (!token) throw new Error('No token');
      const payload = await this.jwt.verifyAsync<JwtPayload>(token, {
        secret: this.config.get<string>('JWT_ACCESS_SECRET'),
      });
      const user = await this.users.findAuthUserById(payload.sub);
      if (!user) throw new Error('Unknown user');
      client.data.user = {
        socketId: client.id,
        id: user.id,
        name: user.name,
        color: COLORS[user.id % COLORS.length],
      } as PresenceUser;
    } catch (err) {
      this.logger.warn(`Rejected socket ${client.id}: ${(err as Error).message}`);
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket) {
    for (const [workflowId, members] of this.presence) {
      if (members.delete(client.id)) this.broadcastPresence(workflowId);
    }
  }

  @SubscribeMessage('workflow:join')
  onJoin(@ConnectedSocket() client: Socket, @MessageBody() body: { workflowId: number }) {
    const user = client.data.user as PresenceUser;
    client.join(room(body.workflowId));
    const members = this.presence.get(body.workflowId) ?? new Map();
    members.set(client.id, user);
    this.presence.set(body.workflowId, members);
    this.broadcastPresence(body.workflowId);
  }

  @SubscribeMessage('workflow:leave')
  onLeave(@ConnectedSocket() client: Socket, @MessageBody() body: { workflowId: number }) {
    client.leave(room(body.workflowId));
    this.presence.get(body.workflowId)?.delete(client.id);
    this.broadcastPresence(body.workflowId);
  }

  /**
   * Persist collaborative graph events and fan them out to other collaborators.
   * Server assigns the authoritative seq; clients reconcile (Last-Write-Wins).
   */
  @SubscribeMessage('workflow:event')
  async onEvent(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { workflowId: number; events: AnyWorkflowEvent[] },
  ) {
    const user = client.data.user as PresenceUser;
    const result = await this.events.append(body.workflowId, body.events, user.id);
    // Broadcast to everyone else in the room (sender already applied optimistically).
    client.to(room(body.workflowId)).emit('workflow:event', {
      workflowId: body.workflowId,
      events: result.events,
      version: result.version,
    });
    // Ack back to the sender with authoritative sequences.
    return { ok: true, events: result.events, version: result.version };
  }

  @SubscribeMessage('cursor:move')
  onCursor(
    @ConnectedSocket() client: Socket,
    @MessageBody() body: { workflowId: number; position: XYPosition },
  ) {
    const user = client.data.user as PresenceUser;
    client.to(room(body.workflowId)).emit('cursor:update', {
      userId: user.id,
      name: user.name,
      color: user.color,
      position: body.position,
    });
  }

  // --- Server-initiated broadcasts (called by services) ----------------------

  emitNotification(payload: {
    type: string;
    title: string;
    message: string;
    workflowId?: number;
  }) {
    this.server?.emit('notification', { ...payload, timestamp: Date.now() });
  }

  emitGraphReplaced(workflowId: number, graph: WorkflowGraph) {
    this.server?.to(room(workflowId)).emit('workflow:graphReplaced', { workflowId, graph });
  }

  private broadcastPresence(workflowId: number) {
    const members = [...(this.presence.get(workflowId)?.values() ?? [])];
    this.server.to(room(workflowId)).emit('presence:update', { workflowId, users: members });
  }
}
