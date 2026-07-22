// Configurável por ambiente: local cai no fallback, produção define VITE_API_URL.
const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

export type SessionSummary = {
  id: string;
  roomId: string;
  startsAt: string;
  movie: { id: string; title: string; duration: number };
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

export async function fetchSessions(): Promise<SessionSummary[]> {
  const response = await fetch(`${API_URL}/sessions`);
  if (!response.ok) throw new Error(`Erro ao buscar sessões (${response.status})`);
  return (await response.json()) as SessionSummary[];
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
