export const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

// Mensagem amigável quando bate no rate limit (HTTP 429).
const TOO_MANY_REQUESTS = 'Muitas tentativas seguidas. Espere alguns segundos e tente de novo.';

export type Movie = {
  id: string;
  title: string;
  duration: number;
  tagline: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genre: string;
  rating: string;
  year: number;
  voteAverage: number;
};

export type MovieSession = {
  id: string;
  roomId: string;
  startsAt: string;
};

export type MovieDetail = Movie & {
  synopsis: string;
  sessions: MovieSession[];
};

export type SeatStatus = {
  seat: string;
  status: 'available' | 'reserved';
  mine: boolean;
};

export function getClientId(): string {
  const stored = localStorage.getItem('cinelock:clientId');
  if (stored) return stored;

  const clientId = crypto.randomUUID();
  localStorage.setItem('cinelock:clientId', clientId);
  return clientId;
}

export async function fetchMovies(): Promise<Movie[]> {
  const response = await fetch(`${API_URL}/movies`);
  if (!response.ok) throw new Error(`Erro ao buscar filmes (${response.status})`);
  return (await response.json()) as Movie[];
}

export async function fetchMovie(movieId: string): Promise<MovieDetail> {
  const response = await fetch(`${API_URL}/movies/${movieId}`);
  if (!response.ok) throw new Error(`Erro ao buscar filme (${response.status})`);
  return (await response.json()) as MovieDetail;
}

export type SessionSummary = {
  id: string;
  roomId: string;
  startsAt: string;
  movie: { id: string; title: string; duration: number };
};

export async function fetchSeats(sessionId: string, clientId: string): Promise<SeatStatus[]> {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/seats?clientId=${clientId}`);
  if (!response.ok) throw new Error(`Erro ao buscar assentos (${response.status})`);
  const body = (await response.json()) as { seats: SeatStatus[] };
  return body.seats;
}

export type SeatFailure = { seat: string; reason: 'invalid-seat' | 'seat-taken' };

export type ReserveSeatsResult = {
  held: string[];
  failed: SeatFailure[];
};

// Um request só pro lote inteiro de assentos. Devolve os que seguramos e os que falharam.
export async function reserveSeats(
  sessionId: string,
  seats: string[],
  clientId: string,
): Promise<ReserveSeatsResult> {
  const response = await fetch(`${API_URL}/reservations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, seats, clientId }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error(TOO_MANY_REQUESTS);
    const body = (await response.json()) as { message?: string };
    throw new Error(body.message ?? `Erro ${response.status} ao reservar`);
  }

  const body = (await response.json()) as { held: string[]; failed: SeatFailure[] };
  return { held: body.held, failed: body.failed };
}

export type ConfirmResult =
  | { ok: true }
  | { ok: false; message: string };

export async function confirmReservations(
  sessionId: string,
  seats: string[],
  clientId: string,
): Promise<ConfirmResult> {
  const response = await fetch(`${API_URL}/reservations/confirm`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, seats, clientId }),
  });

  if (response.ok) return { ok: true };

  const body = (await response.json()) as { message?: string };
  return { ok: false, message: body.message ?? `Erro ${response.status} ao confirmar` };
}

// Cancela os assentos segurados (o cliente desistiu). Best-effort — não bloqueia
// a navegação de volta se falhar.
export async function cancelReservations(
  sessionId: string,
  seats: string[],
  clientId: string,
): Promise<void> {
  await fetch(`${API_URL}/reservations/cancel`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, seats, clientId }),
  });
}

export type PendingReservation = { seats: string[]; expiresAt: string | null };

// Assentos que este cliente segura sem confirmar (pra oferecer "retomar compra").
export async function fetchPendingReservation(
  sessionId: string,
  clientId: string,
): Promise<PendingReservation> {
  const response = await fetch(
    `${API_URL}/reservations/pending?sessionId=${sessionId}&clientId=${clientId}`,
  );
  if (!response.ok) return { seats: [], expiresAt: null };
  return (await response.json()) as PendingReservation;
}

export type RaceAttempt = { attempt: number; won: boolean };
export type RaceResult = {
  seat: string;
  attempts: number;
  winners: number;
  durationMs: number;
  results: RaceAttempt[];
};

// A demo tem sessão própria e isolada (o servidor sempre opera nela).
export async function fetchDemoSession(): Promise<SessionSummary> {
  const response = await fetch(`${API_URL}/demo/session`);
  if (!response.ok) throw new Error(`Erro ao buscar sessão da demo (${response.status})`);
  return (await response.json()) as SessionSummary;
}

// Simulação de concorrência: um request só, e o servidor dispara as N tentativas
// no mesmo assento em paralelo.
export async function runReservationRace(seat: string, attempts: number): Promise<RaceResult> {
  const response = await fetch(`${API_URL}/demo/reserve-race`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ seat, attempts }),
  });

  if (!response.ok) {
    if (response.status === 429) throw new Error(TOO_MANY_REQUESTS);
    const body = (await response.json()) as { message?: string };
    throw new Error(body.message ?? `Erro ${response.status} na simulação`);
  }

  return (await response.json()) as RaceResult;
}

// Reseta a sala da demo. Best-effort — ignora falha.
export async function resetDemoRoom(): Promise<void> {
  await fetch(`${API_URL}/demo/reset`, { method: 'POST' });
}
