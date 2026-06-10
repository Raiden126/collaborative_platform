import { io, type Socket } from 'socket.io-client';
import { getAccessToken } from '@/api/http';

/**
 * Thin singleton wrapper around the Socket.IO client for the `/realtime`
 * namespace. The store's realtime module owns the lifecycle and event wiring.
 */
let socket: Socket | null = null;

export function connectSocket(): Socket {
  if (socket?.connected) return socket;
  socket = io('/realtime', {
    transports: ['websocket'],
    auth: { token: getAccessToken() },
    autoConnect: true,
  });
  return socket;
}

export function getSocket(): Socket | null {
  return socket;
}

export function disconnectSocket() {
  socket?.disconnect();
  socket = null;
}
