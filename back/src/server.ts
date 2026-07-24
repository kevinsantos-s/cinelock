import fastifyCors from '@fastify/cors';
import fastifyRateLimit from '@fastify/rate-limit';
import fastifySwagger from '@fastify/swagger';
import fastifySwaggerUi from '@fastify/swagger-ui';
import Fastify from 'fastify';
import {
  jsonSchemaTransform,
  serializerCompiler,
  validatorCompiler,
} from 'fastify-type-provider-zod';
import { env } from './env.js';
import { rateLimitRedis } from './redis.js';
import { movieRoutes } from './movies/routes.js';
import { reservationRoutes } from './reservations/routes.js';
import { sessionRoutes } from './sessions/routes.js';

const app = Fastify({ logger: true });

app.setValidatorCompiler(validatorCompiler);
app.setSerializerCompiler(serializerCompiler);

await app.register(fastifyCors, { origin: true });

// Store no Redis: com múltiplas instâncias da API, o limite é compartilhado entre elas.
// Desligável via env pro stress-test local (RATE_LIMIT_ENABLED=false).
if (env.RATE_LIMIT_ENABLED) {
  await app.register(fastifyRateLimit, {
    global: true,
    max: 100,
    timeWindow: '1 minute',
    redis: rateLimitRedis,
  });
}

await app.register(fastifySwagger, {
  openapi: {
    info: {
      title: 'Cinelock API',
      description:
        'Reserva de assentos de cinema com lock distribuído no Redis. Selecionar é presença, reservar é autoridade.',
      version: '0.1.0',
    },
  },
  transform: jsonSchemaTransform,
});
await app.register(fastifySwaggerUi, { routePrefix: '/docs' });

await app.register(movieRoutes);
await app.register(sessionRoutes);
await app.register(reservationRoutes);

await app.listen({ port: env.PORT, host: '0.0.0.0' });
