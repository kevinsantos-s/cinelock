import { useCallback, useEffect, useState } from 'react';
import {
  fetchSeats,
  fetchSessions,
  getClientId,
  reserveSeat,
  type SeatStatus,
  type SessionSummary,
} from './api';

const clientId = getClientId();
const SEATS_REFRESH_MS = 5000;

function formatSessionLabel(session: SessionSummary): string {
  const startsAt = new Date(session.startsAt);
  const date = startsAt.toLocaleDateString('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
  const time = startsAt.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return `${session.movie.title} — ${date} ${time} (${session.roomId})`;
}

export function App(): React.JSX.Element {
  const [sessions, setSessions] = useState<SessionSummary[]>([]);
  const [sessionId, setSessionId] = useState<string>('');
  const [seats, setSeats] = useState<SeatStatus[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<string[]>([]);

  const refreshSeats = useCallback(async () => {
    if (!sessionId) return;
    setSeats(await fetchSeats(sessionId, clientId));
  }, [sessionId]);

  useEffect(() => {
    fetchSessions()
      .then((loadedSessions) => {
        setSessions(loadedSessions);
        if (loadedSessions[0]) setSessionId(loadedSessions[0].id);
      })
      .catch(() => setMessages(['API fora do ar? Suba com npm run dev']));
  }, []);

  useEffect(() => {
    setSelectedSeats(new Set());
    void refreshSeats();
    // Sem Socket.io ainda (Fase 2): polling leve pra ver reservas dos outros
    const interval = setInterval(() => void refreshSeats(), SEATS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshSeats]);

  function toggleSeat(seatStatus: SeatStatus): void {
    if (seatStatus.status === 'reserved') return;
    setSelectedSeats((current) => {
      const next = new Set(current);
      if (next.has(seatStatus.seat)) {
        next.delete(seatStatus.seat);
      } else {
        next.add(seatStatus.seat);
      }
      return next;
    });
  }

  async function reserveSelected(): Promise<void> {
    const results = await Promise.all(
      [...selectedSeats].map((seat) => reserveSeat(sessionId, seat, clientId)),
    );
    setMessages(results.map((result) => result.message));
    setSelectedSeats(new Set());
    await refreshSeats();
  }

  function seatClassName(seatStatus: SeatStatus): string {
    if (seatStatus.mine) return 'seat mine';
    if (seatStatus.status === 'reserved') return 'seat reserved';
    if (selectedSeats.has(seatStatus.seat)) return 'seat selected';
    return 'seat available';
  }

  return (
    <main>
      <h1>Cinelock</h1>

      <select value={sessionId} onChange={(event) => setSessionId(event.target.value)}>
        {sessions.map((session) => (
          <option key={session.id} value={session.id}>
            {formatSessionLabel(session)}
          </option>
        ))}
      </select>

      <div className="screen">TELA</div>

      <div className="seat-grid">
        {seats.map((seatStatus) => (
          <button
            key={seatStatus.seat}
            className={seatClassName(seatStatus)}
            onClick={() => toggleSeat(seatStatus)}
            disabled={seatStatus.status === 'reserved'}
          >
            {seatStatus.seat}
          </button>
        ))}
      </div>

      <div className="legend">
        <span className="seat available">livre</span>
        <span className="seat selected">selecionado</span>
        <span className="seat reserved">reservado</span>
        <span className="seat mine">seu</span>
      </div>

      <button className="reserve-button" onClick={() => void reserveSelected()} disabled={selectedSeats.size === 0}>
        Reservar {selectedSeats.size > 0 ? `(${selectedSeats.size})` : ''}
      </button>

      {messages.length > 0 && (
        <ul className="messages">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
