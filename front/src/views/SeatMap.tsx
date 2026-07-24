import { useCallback, useEffect, useState } from 'react';
import {
  fetchSeats,
  getClientId,
  reserveSeat,
  type MovieSession,
  type SeatStatus,
} from '../api';
import { formatDayLabel, formatTime } from '../format';

const clientId = getClientId();
const SEATS_REFRESH_MS = 5000;

type SeatMapProps = {
  session: MovieSession;
  movieTitle: string;
  onBack: () => void;
  onReserved: (seats: string[]) => void;
};

export function SeatMap({ session, movieTitle, onBack, onReserved }: SeatMapProps): React.JSX.Element {
  const [seats, setSeats] = useState<SeatStatus[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [messages, setMessages] = useState<string[]>([]);
  const [reserving, setReserving] = useState(false);

  const refreshSeats = useCallback(async () => {
    setSeats(await fetchSeats(session.id, clientId));
  }, [session.id]);

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
      if (next.has(seatStatus.seat)) next.delete(seatStatus.seat);
      else next.add(seatStatus.seat);
      return next;
    });
  }

  async function reserveSelected(): Promise<void> {
    const chosen = [...selectedSeats];
    setReserving(true);
    try {
      const results = await Promise.all(
        chosen.map((seat) => reserveSeat(session.id, seat, clientId)),
      );
      const heldSeats = results.filter((result) => result.ok).map((result) => result.seat);

      // Só avança pro checkout se conseguimos segurar todos os assentos escolhidos.
      if (heldSeats.length === chosen.length) {
        onReserved(heldSeats);
        return;
      }

      setMessages(results.filter((result) => !result.ok).map((result) => result.message));
      setSelectedSeats(new Set());
      await refreshSeats();
    } finally {
      setReserving(false);
    }
  }

  function seatClassName(seatStatus: SeatStatus): string {
    if (seatStatus.mine) return 'seat mine';
    if (seatStatus.status === 'reserved') return 'seat reserved';
    if (selectedSeats.has(seatStatus.seat)) return 'seat selected';
    return 'seat available';
  }

  return (
    <section className="seatmap">
      <button className="btn-back btn-back--solid" onClick={onBack}>
        ← Voltar
      </button>

      <header className="seatmap-header">
        <h1 className="seatmap-title">{movieTitle}</h1>
        <p className="seatmap-sub">
          {formatDayLabel(session.startsAt)} · {formatTime(session.startsAt)} · {session.roomId}
        </p>
      </header>

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
        <span className="legend-item">
          <span className="seat available" /> livre
        </span>
        <span className="legend-item">
          <span className="seat selected" /> selecionado
        </span>
        <span className="legend-item">
          <span className="seat reserved" /> reservado
        </span>
        <span className="legend-item">
          <span className="seat mine" /> seu
        </span>
      </div>

      <button
        className="btn-primary reserve-button"
        onClick={() => void reserveSelected()}
        disabled={selectedSeats.size === 0 || reserving}
      >
        {reserving
          ? 'Reservando…'
          : `Reservar ${selectedSeats.size > 0 ? `(${selectedSeats.size})` : ''}`}
      </button>

      {messages.length > 0 && (
        <ul className="messages">
          {messages.map((message) => (
            <li key={message}>{message}</li>
          ))}
        </ul>
      )}
    </section>
  );
}
