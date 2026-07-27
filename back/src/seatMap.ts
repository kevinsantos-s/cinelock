export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const SEATS_PER_ROW = 10;

export const ALL_SEATS: string[] = ROWS.flatMap((row) =>
  Array.from({ length: SEATS_PER_ROW }, (_, index) => `${row}${index + 1}`),
);

export function isValidSeat(seat: string): boolean {
  return ALL_SEATS.includes(seat);
}

const SEAT_LOCK_PREFIX = 'seat:';

export function seatLockKey(sessionId: string, seat: string): string {
  return `${SEAT_LOCK_PREFIX}${sessionId}:${seat}`;
}

// Extrai sessão e assento de uma chave de lock (ex.: "seat:<uuid>:A5"). Retorna
// null pra chaves que não são de assento — o listener de expiração ignora o resto.
export function parseSeatLockKey(key: string): { sessionId: string; seat: string } | null {
  if (!key.startsWith(SEAT_LOCK_PREFIX)) return null;
  const [, sessionId, seat] = key.split(':');
  if (!sessionId || !seat) return null;
  return { sessionId, seat };
}
