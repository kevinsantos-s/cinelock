import { useEffect, useRef, useState } from 'react';
import {
  fetchDemoSession,
  fetchSeats,
  getClientId,
  resetDemoRoom,
  runReservationRace,
  type RaceResult,
  type SeatStatus,
  type SessionSummary,
} from '../api';
import { getSocket, type SeatReleasedEvent, type SeatReservedEvent } from '../socket';
import { SeatGrid } from './SeatGrid';

const clientId = getClientId();
const FIRST_SEAT = 'A5';
const ATTEMPTS = 30;
const TOAST_MS = 4000;

// Próximo assento livre após o atual (embrulha no fim) — pra cada teste usar uma
// cadeira nova e a sala ir "enchendo" de reservas até o reset. `taken` cobre assentos
// que acabaram de ser reservados mas que o estado local pode ainda não refletir.
function pickNextSeat(seats: SeatStatus[], current: string, taken: Set<string> = new Set()): string {
  const start = seats.findIndex((seat) => seat.seat === current);
  for (let step = 1; step <= seats.length; step += 1) {
    const candidate = seats[(start + step) % seats.length];
    if (
      candidate &&
      candidate.status === 'available' &&
      candidate.seat !== current &&
      !taken.has(candidate.seat)
    ) {
      return candidate.seat;
    }
  }
  return current;
}

type DemoConcurrencyProps = {
  onBack: () => void;
};

export function DemoConcurrency({ onBack }: DemoConcurrencyProps): React.JSX.Element {
  const [session, setSession] = useState<SessionSummary | null>(null);
  const [seats, setSeats] = useState<SeatStatus[]>([]);
  const [targetSeat, setTargetSeat] = useState(FIRST_SEAT);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<RaceResult | null>(null);
  const [toast, setToast] = useState<{ id: number; text: string } | null>(null);

  // Refs pro handler do socket ler o valor atual sem recriar o listener.
  const seatsRef = useRef(seats);
  const targetSeatRef = useRef(targetSeat);
  useEffect(() => {
    seatsRef.current = seats;
  }, [seats]);
  useEffect(() => {
    targetSeatRef.current = targetSeat;
  }, [targetSeat]);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), TOAST_MS);
    return () => clearTimeout(timer);
  }, [toast]);

  function showToast(text: string): void {
    setToast({ id: Date.now(), text });
  }

  useEffect(() => {
    void fetchDemoSession().then(setSession);
  }, []);

  useEffect(() => {
    if (!session) return;
    // Carrega o estado atual (sem resetar — pra não apagar o que outra aba fez).
    void fetchSeats(session.id, clientId).then(setSeats);

    // Tempo real: o assento fica vermelho/livre ao vivo conforme a corrida resolve.
    const socket = getSocket();
    socket.emit('join', session.id);
    const applyStatus = (targetSeats: string[], status: 'reserved' | 'available'): void => {
      const affected = new Set(targetSeats);
      setSeats((current) =>
        current.map((seat) => (affected.has(seat.seat) ? { ...seat, status, mine: false } : seat)),
      );
    };
    const onReserved = (event: SeatReservedEvent): void => {
      if (event.sessionId !== session.id) return;
      applyStatus(event.seats, 'reserved');

      // Se o assento que eu ia testar foi levado (por outra aba), avisa e pula pro próximo.
      if (event.seats.includes(targetSeatRef.current)) {
        showToast(`Assento ${targetSeatRef.current} foi reservado — pulando pro próximo`);
        const taken = new Set(event.seats);
        setTargetSeat((current) => pickNextSeat(seatsRef.current, current, taken));
      }
    };
    const onReleased = (event: SeatReleasedEvent): void => {
      if (event.sessionId === session.id) applyStatus(event.seats, 'available');
    };
    socket.on('seat:reserved', onReserved);
    socket.on('seat:released', onReleased);

    return () => {
      socket.emit('leave', session.id);
      socket.off('seat:reserved', onReserved);
      socket.off('seat:released', onReleased);
      // Ao sair da demo, limpa a sala por completo.
      void resetDemoRoom();
    };
  }, [session]);

  async function simulate(): Promise<void> {
    if (!session) return;
    setRunning(true);
    setResult(null);
    try {
      const raceResult = await runReservationRace(targetSeat, ATTEMPTS);
      setResult(raceResult);
      setTargetSeat((current) => pickNextSeat(seats, current));
    } catch (error) {
      showToast(error instanceof Error ? error.message : 'Erro na simulação');
    } finally {
      setRunning(false);
    }
  }

  async function resetRoom(): Promise<void> {
    if (!session) return;
    await resetDemoRoom();
    setSeats(await fetchSeats(session.id, clientId));
    setTargetSeat(FIRST_SEAT);
    setResult(null);
  }

  function seatClassName(seat: SeatStatus): string {
    const base = seat.seat === targetSeat ? 'seat demo-target' : 'seat';
    if (seat.status === 'reserved') return `${base} reserved`;
    return `${base} available`;
  }

  const losers = result ? result.attempts - result.winners : 0;
  const winningAttempt = result?.results.find((attempt) => attempt.won);

  return (
    <section className="demo">
      <button className="btn-back btn-back--solid" onClick={onBack}>
        ← Voltar
      </button>

      <header className="demo-header">
        <h1 className="demo-title">Demonstração de concorrência</h1>
        <p className="demo-sub">
          E se {ATTEMPTS} pessoas clicassem em "reservar" no assento <strong>{targetSeat}</strong> no
          mesmo segundo? Só uma pode levar. Clica e vê o sistema escolher quem fica com ele — sem
          nunca vender o mesmo lugar duas vezes.
        </p>
      </header>

      <div className="demo-layout">
        <div className="demo-stage">
          <div className="screen">TELA</div>
          <SeatGrid
            seats={seats}
            renderSeat={(seat) => (
              <span className={seatClassName(seat)} title={seat.seat}>
                {seat.seat.slice(1)}
              </span>
            )}
          />
        </div>

        <div className="demo-panel">
          <div className="demo-actions">
            <button
              className="btn-primary"
              onClick={() => void simulate()}
              disabled={running || !session}
            >
              {running ? 'Simulando…' : `Simular ${ATTEMPTS} pessoas no ${targetSeat}`}
            </button>
            <button className="btn-ghost" onClick={() => void resetRoom()} disabled={running}>
              Resetar sala
            </button>
          </div>

          {result && (
            <>
              <div className="demo-counter">
                <span className="demo-counter-win">
                  {result.winners} conseguiu
                  {winningAttempt ? ` (pessoa ${winningAttempt.attempt})` : ''}
                </span>
                <span className="demo-counter-lose">{losers} ficaram sem</span>
              </div>
              <p className="demo-resolved">
                As {result.attempts} tentativas foram resolvidas em {result.durationMs.toFixed(1)}ms —
                e o assento nunca foi vendido duas vezes.
              </p>
              <ul className="demo-log">
                {result.results.map((attempt) => (
                  <li key={attempt.attempt} className={attempt.won ? 'demo-log-win' : 'demo-log-lose'}>
                    <span>Pessoa {attempt.attempt}</span>
                    <span>{attempt.won ? 'ficou com o assento 🎟️' : 'não conseguiu'}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
        </div>
      </div>

      {toast && (
        <div className="toast" role="status" aria-live="polite" key={toast.id}>
          {toast.text}
        </div>
      )}
    </section>
  );
}
