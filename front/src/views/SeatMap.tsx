import { useCallback, useEffect, useRef, useState } from 'react';
import {
  fetchPendingReservation,
  fetchSeats,
  getClientId,
  reserveSeats,
  type MovieSession,
  type SeatFailure,
  type SeatStatus,
} from '../api';
import { getSocket, type SeatReleasedEvent, type SeatReservedEvent } from '../socket';
import { SeatGrid } from './SeatGrid';
import { formatDayLabel, formatTime } from '../format';

const clientId = getClientId();
const SEATS_REFRESH_MS = 30000;
const TOAST_MS = 4000;
const MAX_SEATS = 6;

function formatMMSS(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

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
  onResume: (seats: string[], expiresAt: string) => void;
};

export function SeatMap({
  session,
  movieTitle,
  onBack,
  onReserved,
  onResume,
}: SeatMapProps): React.JSX.Element {
  const [seats, setSeats] = useState<SeatStatus[]>([]);
  const [selectedSeats, setSelectedSeats] = useState<Set<string>>(new Set());
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);
  const [reserving, setReserving] = useState(false);
  // Reserva pendente (segura sem confirmar) pra oferecer "retomar compra" ao voltar.
  const [pendingResume, setPendingResume] = useState<{ seats: string[]; expiresAt: string } | null>(
    null,
  );
  const [nowMs, setNowMs] = useState(Date.now());

  // Espelha a seleção num ref pra o handler do socket ler o valor atual sem recriar o listener.
  const selectedSeatsRef = useRef(selectedSeats);
  useEffect(() => {
    selectedSeatsRef.current = selectedSeats;
  }, [selectedSeats]);

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
    const interval = setInterval(() => void refreshSeats(), SEATS_REFRESH_MS);
    return () => clearInterval(interval);
  }, [refreshSeats]);

  // Ao abrir, verifica se este cliente já tem assentos segurados sem confirmar.
  useEffect(() => {
    void fetchPendingReservation(session.id, clientId).then((pending) => {
      if (pending.seats.length > 0 && pending.expiresAt) {
        setPendingResume({ seats: pending.seats, expiresAt: pending.expiresAt });
      }
    });
  }, [session.id]);

  // Contador do aviso de "retomar compra" — só corre quando há reserva pendente.
  useEffect(() => {
    if (!pendingResume) return;
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [pendingResume]);

  useEffect(() => {
    const socket = getSocket();
    const joinRoom = (): void => {
      socket.emit('join', session.id);
    };
    joinRoom();
    socket.on('connect', joinRoom);

    const onSeatReserved = (event: SeatReservedEvent): void => {
      if (event.sessionId !== session.id) return;
      const reserved = new Set(event.seats);
      setSeats((current) =>
        current.map((seatStatus) =>
          reserved.has(seatStatus.seat) ? { ...seatStatus, status: 'reserved' } : seatStatus,
        ),
      );

      // Se um assento que EU tinha selecionado foi levado por outro, avisa e tira da seleção.
      const takenFromMine = event.seats.filter((seat) => selectedSeatsRef.current.has(seat));
      if (takenFromMine.length === 1) {
        showToast(`Assento ${takenFromMine[0]} acabou de ser reservado por outra pessoa`);
      } else if (takenFromMine.length > 1) {
        showToast(`Assentos ${takenFromMine.join(', ')} acabaram de ser reservados por outros`);
      }
      setSelectedSeats((current) => {
        const next = new Set(current);
        for (const seat of event.seats) next.delete(seat);
        return next;
      });
    };
    socket.on('seat:reserved', onSeatReserved);

    // Assento liberado (reserva expirou sem confirmar) volta a ficar disponível.
    const onSeatReleased = (event: SeatReleasedEvent): void => {
      if (event.sessionId !== session.id) return;
      const released = new Set(event.seats);
      setSeats((current) =>
        current.map((seatStatus) =>
          released.has(seatStatus.seat)
            ? { ...seatStatus, status: 'available', mine: false }
            : seatStatus,
        ),
      );
    };
    socket.on('seat:released', onSeatReleased);

    return () => {
      socket.emit('leave', session.id);
      socket.off('connect', joinRoom);
      socket.off('seat:reserved', onSeatReserved);
      socket.off('seat:released', onSeatReleased);
    };
  }, [session.id]);

  function toggleSeat(seatStatus: SeatStatus): void {
    if (seatStatus.status === 'reserved') return;
    setSelectedSeats((current) => {
      const next = new Set(current);
      if (next.has(seatStatus.seat)) {
        next.delete(seatStatus.seat);
      } else {
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
      const { held, failed } = await reserveSeats(session.id, chosen, clientId);

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

  const resumeSecondsLeft = pendingResume
    ? Math.max(0, Math.floor((new Date(pendingResume.expiresAt).getTime() - nowMs) / 1000))
    : 0;
  const showResume = pendingResume !== null && resumeSecondsLeft > 0;

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

      {showResume && pendingResume && (
        <div className="resume-banner">
          <div className="resume-info">
            <span className="resume-title">
              Você tem {pendingResume.seats.length}{' '}
              {pendingResume.seats.length > 1 ? 'assentos reservados' : 'assento reservado'}
            </span>
            <span className="resume-sub">
              {pendingResume.seats.join(', ')} · confirme em {formatMMSS(resumeSecondsLeft)}
            </span>
          </div>
          <button
            className="btn-primary resume-btn"
            onClick={() => onResume(pendingResume.seats, pendingResume.expiresAt)}
          >
            Continuar compra
          </button>
        </div>
      )}

      <div className="screen">TELA</div>

      <SeatGrid
        seats={seats}
        renderSeat={(seatStatus) => (
          <button
            className={seatClassName(seatStatus)}
            onClick={() => toggleSeat(seatStatus)}
            disabled={seatStatus.status === 'reserved'}
            title={seatStatus.seat}
          >
            {seatStatus.seat.slice(1)}
          </button>
        )}
      />

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
