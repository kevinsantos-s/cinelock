import { createAdapter } from '@socket.io/redis-adapter';
import type { FastifyInstance } from 'fastify';
import { Server } from 'socket.io';
import { z } from 'zod';
import { redis } from './redis.js';

// Payload do cliente ao entrar na sala de uma sessão. Entrada externa → validada.
const joinPayloadSchema = z.string().uuid();

export function roomForSession(sessionId: string): string {
  return `session:${sessionId}`;
}

// Pega carona no mesmo servidor HTTP do Fastify (mesma porta). Cada cliente entra
// na room da sessão que está vendo, e só recebe eventos daquela sessão.
export function initRealtime(app: FastifyInstance): void {
  const io = new Server(app.server, { cors: { origin: true } });

  // Adapter no Redis: o consumer roda em outro processo e emite via pub/sub —
  // sem isso, um emit de lá não chegaria nos clientes conectados nesta instância.
  io.adapter(createAdapter(redis.duplicate(), redis.duplicate()));

  io.on('connection', (socket) => {
    socket.on('join', (payload: unknown) => {
      const parsed = joinPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      void socket.join(roomForSession(parsed.data));
    });

    socket.on('leave', (payload: unknown) => {
      const parsed = joinPayloadSchema.safeParse(payload);
      if (!parsed.success) return;
      void socket.leave(roomForSession(parsed.data));
    });
  });
}
