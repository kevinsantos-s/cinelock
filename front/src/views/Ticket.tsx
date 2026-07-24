import type { MovieSession } from '../api';
import { formatDayLabel, formatTime } from '../format';

type TicketProps = {
  session: MovieSession;
  movieTitle: string;
  seats: string[];
  onFinish: () => void;
};

export function Ticket({ session, movieTitle, seats, onFinish }: TicketProps): React.JSX.Element {
  return (
    <section className="ticket">
      <div className="ticket-stub">
        <div className="ticket-check">✓</div>
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
            <span className="ticket-key">Assentos</span>
            <span className="ticket-value">{seats.join(', ')}</span>
          </div>
        </div>

        <div className="ticket-perforation" />

        <ul className="ticket-tips">
          <li>Chegue com 15 minutos de antecedência.</li>
          <li>
            Dirija-se à <strong>{session.roomId}</strong> e procure{' '}
            {seats.length > 1 ? 'os assentos' : 'o assento'} <strong>{seats.join(', ')}</strong>.
          </li>
          <li>Apresente este comprovante na entrada da sala.</li>
        </ul>

        <button className="btn-primary ticket-finish" onClick={onFinish}>
          Voltar ao início
        </button>
      </div>
    </section>
  );
}
