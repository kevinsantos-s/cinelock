import { useEffect, useState } from 'react';
import { confirmReservations, getClientId, type MovieSession } from '../api';
import { formatDayLabel, formatTime } from '../format';

const clientId = getClientId();
const HOLD_SECONDS = 300; // mesmo TTL do lock no back (RESERVATION_TTL_SECONDS)

type CheckoutProps = {
  session: MovieSession;
  movieTitle: string;
  seats: string[];
  onConfirmed: () => void;
  onCancel: () => void;
};

function formatCountdown(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function Checkout({
  session,
  movieTitle,
  seats,
  onConfirmed,
  onCancel,
}: CheckoutProps): React.JSX.Element {
  const [secondsLeft, setSecondsLeft] = useState(HOLD_SECONDS);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((current) => Math.max(0, current - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const expired = secondsLeft === 0;

  async function confirm(): Promise<void> {
    setConfirming(true);
    setError(null);
    const result = await confirmReservations(session.id, seats, clientId);
    setConfirming(false);
    if (result.ok) {
      onConfirmed();
    } else {
      setError(result.message);
    }
  }

  return (
    <section className="checkout">
      <div className="checkout-card">
        <span className="checkout-step">Confirme sua reserva</span>
        <h1 className="checkout-movie">{movieTitle}</h1>
        <p className="checkout-session">
          {formatDayLabel(session.startsAt)} · {formatTime(session.startsAt)} · {session.roomId}
        </p>

        <div className="checkout-seats">
          <span className="checkout-label">Assentos</span>
          <div className="seat-chips">
            {seats.map((seat) => (
              <span key={seat} className="seat-chip">
                {seat}
              </span>
            ))}
          </div>
        </div>

        <div className={`countdown ${secondsLeft <= 60 ? 'countdown--urgent' : ''}`}>
          {expired ? (
            <span>Tempo esgotado — os assentos foram liberados.</span>
          ) : (
            <>
              <span className="countdown-label">Confirme em</span>
              <span className="countdown-time">{formatCountdown(secondsLeft)}</span>
            </>
          )}
        </div>

        {error && <p className="checkout-error">{error}</p>}

        <div className="checkout-actions">
          <button className="btn-ghost" onClick={onCancel}>
            Cancelar
          </button>
          <button
            className="btn-primary"
            onClick={() => void confirm()}
            disabled={confirming || expired}
          >
            {confirming ? 'Confirmando…' : 'Confirmar compra'}
          </button>
        </div>
      </div>
    </section>
  );
}
