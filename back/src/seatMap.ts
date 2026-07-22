export const ROWS = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'] as const;
export const SEATS_PER_ROW = 10;

export const ALL_SEATS: string[] = ROWS.flatMap((row) =>
  Array.from({ length: SEATS_PER_ROW }, (_, index) => `${row}${index + 1}`),
);

export function isValidSeat(seat: string): boolean {
  return ALL_SEATS.includes(seat);
}

export function seatLockKey(sessionId: string, seat: string): string {
  return `seat:${sessionId}:${seat}`;
}
