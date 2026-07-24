import { z } from 'zod';

// Campos que a vitrine precisa pra desenhar cada card.
const movieCardSchema = z.object({
  id: z.string().uuid(),
  title: z.string(),
  duration: z.number(),
  tagline: z.string().nullable(),
  posterUrl: z.string().nullable(),
  backdropUrl: z.string().nullable(),
  genre: z.string(),
  rating: z.string(),
  year: z.number(),
  voteAverage: z.number(),
});

export const movieListResponseSchema = z.array(movieCardSchema);

const sessionSummarySchema = z.object({
  id: z.string().uuid(),
  roomId: z.string(),
  startsAt: z.date(),
});

export const movieDetailResponseSchema = movieCardSchema.extend({
  synopsis: z.string(),
  sessions: z.array(sessionSummarySchema),
});

export const movieParamsSchema = z.object({ id: z.string().uuid() });

export const errorSchema = z.object({ message: z.string() });
