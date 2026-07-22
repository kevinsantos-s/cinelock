import { z } from 'zod';

export const sessionListResponseSchema = z.array(
  z.object({
    id: z.string().uuid(),
    roomId: z.string(),
    startsAt: z.date(),
    movie: z.object({
      id: z.string().uuid(),
      title: z.string(),
      duration: z.number(),
    }),
  }),
);

export const sessionParamsSchema = z.object({ id: z.string().uuid() });

export const seatsQuerySchema = z.object({ clientId: z.string().uuid().optional() });

const seatStatusSchema = z.object({
  seat: z.string(),
  status: z.enum(['available', 'reserved']),
  mine: z.boolean(),
});

export const seatsResponseSchema = z.object({ seats: z.array(seatStatusSchema) });

export const errorSchema = z.object({ message: z.string() });
