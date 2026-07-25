import { useCallback, useEffect, useState } from 'react';
import {
  fetchSeats,
  getClientId,
  reserveSeats,
  type MovieSession,
  type SeatFailure,
  type SeatStatus,
} from '../api';
import { formatDayLabel, formatTime } from '../format';

const clientId = getClientId();
const SEATS_REFRESH_MS = 5000;
const TOAST_MS = 4000;
// Espelha MAX_SEATS_PER_RESERVATION do backend. Aqui é só UX — quem impede de
// verdade é a validação no servidor; isto evita frustrar o usuário na hora de reservar.
const MAX_SEATS = 5;

// Monta um aviso legível a partir dos assentos que falharam.
function describeFailures(failed: SeatFailure[]): string {
  const taken = failed.filter((item) => item.reason === 'seat-taken').map((item) => item.seat);
  const invalid = failed.filter((item) => item.reason === 'invalid-seat').map((item) => item.seat);

  const parts: string[] = [];
  if (taken.length === 1) parts.push(`Assento ${taken[0]} já foi reservado`);
  else if (taken.length > 1) parts.push(`Assentos ${taken.join(', ')} já foram reservados`);
  if (invalid.length > 0) parts.push(`Assento(s) ${invalid.join(', ')} inválido(s)`);
  return parts.join(' · ');
}

type SeatMapProps = {
  session: MovieSession;
  movieTitle: string;
  onBack: () => void;
  onReserved: (seats: string[]) => void;
};

export function SeatMap({ session, movieTitle, onBack, onReserved }: SeatMapProps): React.JSX.Element {
  const [seats, setSeats] = useState<SeatStatus[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [reserving, setReserving] = useState(false);

  // Toast some sozinho depois de alguns segundos. O `id` reinicia o timer a cada aviso novo.
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function showToast(text: string): void {
    setToast({ id: Date.now(), text });
  }

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
      if (next.has(seatStatus.seat)) {
        next.delete(seatStatus.seat);
      } else {
        // Desmarcar sempre é permitido; só o "marcar mais um" respeita o teto.
        if (next.size >= MAX_SEATS) {
          showToast(`Máximo de ${MAX_SEATS} ingressos por compra`);
          return current;
        }
        next.add(seatStatus.seat);
      }
      return next;
    });
  }

  async function reserveSelected(): Promise<void> {
    const chosen = [...selectedSeats];
    setReserving(true);
    try {
      // Um request só pro lote inteiro — nada de N chamadas em paralelo.
      const { held, failed } = await reserveSeats(session.id, chosen, clientId);

      // Só avança pro checkout se conseguimos segurar todos os assentos escolhidos.
      if (failed.length === 0) {
        onReserved(held);
        return;
      }

      showToast(describeFailures(failed));
      setSelectedSeats(new Set());
      await refreshSeats();
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro ao reservar');
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

      {toast && (
        <div className="toast" role="status" aria-live="polite" key={toast.id}>
          {toast.text}
        </div>
      )}
    </section>
  );
}
