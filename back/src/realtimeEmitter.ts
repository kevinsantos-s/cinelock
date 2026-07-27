import { Emitter } from '@socket.io/redis-emitter';
import { redis } from './redis.js';
import { roomForSession } from './realtime.js';

// Emite pros clientes do Socket.io de qualquer processo (consumer, demo) via
// pub/sub no Redis — o servidor HTTP tem o adapter correspondente em realtime.ts.
const emitter = new Emitter(redis);

export function emitSeatReserved(sessionId: string, seats: string[]): void {
  if (seats.length === 0) return;
  emitter.to(roomForSession(sessionId)).emit('seat:reserved', { sessionId, seats });
}

export function emitSeatReleased(sessionId: string, seats: string[]): void {
  if (seats.length === 0) return;
  emitter.to(roomForSession(sessionId)).emit('seat:released', { sessionId, seats });
}
