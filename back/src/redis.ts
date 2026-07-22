import { Redis } from 'ioredis';
import { env } from './env.js';

export const redis = new Redis(env.REDIS_URL);

// se o Redis cair, o request falha rápido em vez de ficar pendurado esperando retry.
export const rateLimitRedis = new Redis(env.REDIS_URL, {
  connectTimeout: 500,
  maxRetriesPerRequest: 1,
});
