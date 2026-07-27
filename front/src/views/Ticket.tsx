import type { MovieSession } from '../api';
import { formatDayLabel, formatTime } from '../format';

type TicketProps = {
  session: MovieSession;
  movieTitle: string;
  seats: string[];
  onFinish: () => void;
};

export function Ticket({ session, movieTitle, seats, onFinish }: TicketProps): React.JSX.Element {
  // Código do ingresso derivado do id da sessão — estável e com cara de comprovante.
  const ticketCode = `CL-${session.id.replace(/-/g, '').slice(0, 8).toUpperCase()}`;

  return (
    <section className="ticket">
      <article className="ticket-card">
        <header className="ticket-head">
          <span className="ticket-brand">
            CINE<span className="brand-accent">LOCK</span>
          </span>
          <span className="ticket-code">{ticketCode}</span>
        </header>

        <div className="ticket-body">
          <span className="ticket-status">Compra confirmada</span>
          <h1 className="ticket-movie">{movieTitle}</h1>

          <div className="ticket-grid">
            <div className="ticket-field">
              <span className="ticket-key">Data</span>
              <span className="ticket-value">{formatDayLabel(session.startsAt)}</span>
            </div>
            <div className="ticket-field">
              <span className="ticket-key">Horário</span>
              <span className="ticket-value">{formatTime(session.startsAt)}</span>
            </div>
            <div className="ticket-field">
              <span className="ticket-key">Sala</span>
              <span className="ticket-value ticket-room">{session.roomId}</span>
            </div>
            <div className="ticket-field">
              <span className="ticket-key">Nº do ingresso</span>
              <span className="ticket-value ticket-mono">{ticketCode}</span>
            </div>
          </div>

          <ul className="ticket-tips">
            <li>Chegue com 15 minutos de antecedência.</li>
            <li>
              Dirija-se à <strong>{session.roomId}</strong> e procure{' '}
              {seats.length > 1 ? 'os assentos' : 'o assento'}.
            </li>
            <li>Apresente este comprovante na entrada.</li>
          </ul>
        </div>

        <div className="ticket-rip" aria-hidden="true" />

        <div className="ticket-stub">
          <div className="ticket-seats-block">
            <span className="ticket-key">
              {seats.length > 1 ? 'Assentos' : 'Assento'}
            </span>
            <span className="ticket-seats">{seats.join(' · ')}</span>
          </div>
          <div className="ticket-barcode" aria-hidden="true" />
        </div>
      </article>

      <button className="btn-primary ticket-finish" onClick={onFinish}>
        Voltar ao início
      </button>
    </section>
  );
}
