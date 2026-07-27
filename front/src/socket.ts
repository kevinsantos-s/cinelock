import { io, type Socket } from 'socket.io-client';
import { API_URL } from './api';

export type SeatReservedEvent = { sessionId: string; seats: string[] };
export type SeatReleasedEvent = { sessionId: string; seats: string[] };

let socket: Socket | null = null;

export function getSocket(): Socket {
  if (!socket) {
    socket = io(API_URL);
  }
  return socket;
}
