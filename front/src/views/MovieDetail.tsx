import { useEffect, useMemo, useState } from 'react';
import { fetchMovie, type MovieDetail as MovieDetailData, type MovieSession } from '../api';
import { RatingBadge } from '../components/RatingBadge';
import { formatDayKey, formatDayLabel, formatDuration, formatTime } from '../format';

type MovieDetailProps = {
  movieId: string;
  onBack: () => void;
  onSelectSession: (session: MovieSession, movie: MovieDetailData) => void;
};

type DayGroup = { key: string; label: string; sessions: MovieSession[] };

// Formatos de exibição — enriquecem a tela como num cinema real. Cada um mostra um
// recorte dos horários do dia (o mapa de assentos é o mesmo por trás).
const FORMATS = [
  { tag: 'Dublado · 2D', filter: () => true },
  { tag: 'Legendado · 2D', filter: (hour: number) => hour >= 17 },
  { tag: 'Dublado · 3D', filter: (hour: number) => hour >= 20 },
] as const;

function sessionHour(iso: string): number {
  return new Date(iso).getHours();
}

function groupByDay(sessions: MovieSession[]): DayGroup[] {
  const groups = new Map<string, DayGroup>();
  for (const session of sessions) {
    const key = formatDayKey(session.startsAt);
    const group = groups.get(key) ?? { key, label: formatDayLabel(session.startsAt), sessions: [] };
    group.sessions.push(session);
    groups.set(key, group);
  }
  return [...groups.values()];
}

export function MovieDetail({ movieId, onBack, onSelectSession }: MovieDetailProps): React.JSX.Element {
  const [movie, setMovie] = useState<MovieDetailData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeDay, setActiveDay] = useState<string | null>(null);

  useEffect(() => {
    setMovie(null);
    setActiveDay(null);
    fetchMovie(movieId)
      .then(setMovie)
      .catch(() => setError('Não foi possível carregar o filme.'));
  }, [movieId]);

  const days = useMemo(() => (movie ? groupByDay(movie.sessions) : []), [movie]);
  const selectedDay = days.find((day) => day.key === activeDay) ?? days[0];

  if (error) return <p className="state-message">{error}</p>;
  if (!movie) return <p className="state-message">Carregando…</p>;

  return (
    <article className="detail">
      <div
        className="detail-banner"
        style={movie.backdropUrl ? { backgroundImage: `url(${movie.backdropUrl})` } : undefined}
      >
        <button className="btn-back" onClick={onBack}>
          ← Voltar
        </button>
      </div>

      <div className="detail-body">
        {movie.posterUrl ? (
          <img className="detail-poster" src={movie.posterUrl} alt={movie.title} />
        ) : (
          <div className="detail-poster poster-fallback">{movie.title}</div>
        )}

        <div className="detail-info">
          <h1 className="detail-title">{movie.title}</h1>
          {movie.tagline && <p className="detail-tagline">{movie.tagline}</p>}

          <div className="meta-row">
            <RatingBadge rating={movie.rating} />
            <span>{movie.year}</span>
            <span>{formatDuration(movie.duration)}</span>
            <span>{movie.genre}</span>
            <span className="score">★ {movie.voteAverage.toFixed(1)}</span>
          </div>

          <p className="detail-synopsis">{movie.synopsis}</p>
        </div>
      </div>

      <section className="showtimes">
        <h2 className="row-title">Sessões</h2>
        {days.length === 0 && <p className="state-message">Sem sessões disponíveis.</p>}

        {days.length > 0 && (
          <>
            <div className="day-tabs">
              {days.map((day) => {
                const [weekday, date] = day.label.split(' ');
                const isActive = day.key === selectedDay?.key;
                return (
                  <button
                    key={day.key}
                    className={`day-tab ${isActive ? 'day-tab--active' : ''}`}
                    onClick={() => setActiveDay(day.key)}
                  >
                    <span className="day-tab-weekday">{weekday?.replace('.', '')}</span>
                    <span className="day-tab-date">{date}</span>
                  </button>
                );
              })}
            </div>

            {selectedDay &&
              FORMATS.map((format) => {
                const sessions = selectedDay.sessions.filter((session) =>
                  format.filter(sessionHour(session.startsAt)),
                );
                if (sessions.length === 0) return null;
                return (
                  <div key={format.tag} className="session-block">
                    <span className="session-block-tag">{format.tag}</span>
                    <div className="time-list">
                      {sessions.map((session) => (
                        <button
                          key={session.id}
                          className="time-pill"
                          onClick={() => onSelectSession(session, movie)}
                        >
                          {formatTime(session.startsAt)}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
          </>
        )}
      </section>
    </article>
  );
}
