// Configurável por ambiente: local cai no fallback, produção define VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

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

export async function fetchSeats(sessionId: string, clientId: string): Promise<SeatStatus[]> {
  const response = await fetch(`${API_URL}/sessions/${sessionId}/seats?clientId=${clientId}`);
  if (!response.ok) throw new Error(`Erro ao buscar assentos (${response.status})`);
  const body = (await response.json()) as { seats: SeatStatus[] };
  return body.seats;
}

export type ReservationResult = { seat: string; ok: boolean; message: string };

export async function reserveSeat(
  sessionId: string,
  seat: string,
  clientId: string,
): Promise<ReservationResult> {
  const response = await fetch(`${API_URL}/reservations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, seat, clientId }),
  });

  if (response.status === 201) {
    return { seat, ok: true, message: `Assento ${seat} reservado por 5 minutos` };
  }

  const body = (await response.json()) as { message?: string };
  return { seat, ok: false, message: body.message ?? `Erro ${response.status} no assento ${seat}` };
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
