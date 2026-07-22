// Suba a API com o rate limit desligado pra os 30 requests não tomarem 429:
//   RATE_LIMIT_ENABLED=false npm --prefix back run dev
import { randomUUID } from 'node:crypto';

const API_URL = process.env.API_URL ?? 'http://localhost:3000';
const CONCURRENT_REQUESTS = 30;

type SessionSummary = { id: string; movie: { title: string } };
type SeatStatus = { seat: string; status: 'available' | 'reserved' };
type AttemptResult = { requestNumber: number; status: number; durationMs: number };

async function fetchJson<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} → ${response.status}`);
  }
  return (await response.json()) as T;
}

async function attemptReservation(
  requestNumber: number,
  sessionId: string,
  seat: string,
): Promise<AttemptResult> {
  const startedAt = performance.now();
  const response = await fetch(`${API_URL}/reservations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ sessionId, seat, clientId: randomUUID() }),
  });
  const durationMs = performance.now() - startedAt;
  return { requestNumber, status: response.status, durationMs };
}

async function main(): Promise<void> {
  const sessions = await fetchJson<SessionSummary[]>('/sessions');
  const session = sessions[0];
  if (!session) {
    throw new Error('Nenhuma sessão encontrada — rode o seed primeiro (npm run db:seed)');
  }

  const { seats } = await fetchJson<{ seats: SeatStatus[] }>(`/sessions/${session.id}/seats`);
  const freeSeat = seats.find((seatStatus) => seatStatus.status === 'available');
  if (!freeSeat) {
    throw new Error('Nenhum assento livre nesta sessão — rode o seed de novo');
  }

  console.log(`Sessão: "${session.movie.title}" (${session.id})`);
  console.log(`Assento alvo: ${freeSeat.seat}`);
  console.log(`Disparando ${CONCURRENT_REQUESTS} requests simultâneos...\n`);

  const results = await Promise.all(
    Array.from({ length: CONCURRENT_REQUESTS }, (_, index) =>
      attemptReservation(index + 1, session.id, freeSeat.seat),
    ),
  );

  for (const result of results) {
    const outcome = result.status === 201 ? '201 Created ✓' : `${result.status} Conflict`;
    console.log(`Request #${result.requestNumber} → ${outcome} (${result.durationMs.toFixed(1)}ms)`);
  }

  const created = results.filter((result) => result.status === 201).length;
  const conflicts = results.filter((result) => result.status === 409).length;
  const others = results.length - created - conflicts;
  const durations = results.map((result) => result.durationMs).sort((a, b) => a - b);
  const p50 = durations[Math.floor(durations.length / 2)] ?? 0;
  const max = durations[durations.length - 1] ?? 0;

  console.log(`\nResultado: ${created} sucesso / ${conflicts} conflitos (409) / ${others} outros`);
  console.log(`Latência: p50 ${p50.toFixed(1)}ms, máx ${max.toFixed(1)}ms`);

  if (created !== 1) {
    console.error('\nFALHOU: esperava exatamente 1 sucesso — há race condition!');
    process.exitCode = 1;
  } else {
    console.log('\nOK: exatamente 1 request conseguiu o assento. Lock atômico funcionando.');
  }
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
