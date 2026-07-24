import { useEffect, useRef, useState } from 'react';
import { fetchMovies, type Movie } from '../api';
import { RatingBadge } from '../components/RatingBadge';
import { formatDuration } from '../format';

type VitrineProps = {
  onSelectMovie: (movieId: string) => void;
};

export function Vitrine({ onSelectMovie }: VitrineProps): React.JSX.Element {
  const [movies, setMovies] = useState<Movie[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchMovies()
      .then(setMovies)
      .catch(() => setError('Não foi possível carregar os filmes. A API está no ar?'));
  }, []);

  if (error) {
    return <p className="state-message">{error}</p>;
  }

  const featured = movies[0];
  if (!featured) {
    return <p className="state-message">Carregando filmes…</p>;
  }

  const classics = movies.filter((movie) => movie.year < 2010);

  return (
    <div className="vitrine">
      <Hero movie={featured} onSelect={() => onSelectMovie(featured.id)} />

      <PosterRow title="Em cartaz" movies={movies} direction={1} onSelectMovie={onSelectMovie} />

      {classics.length > 2 && (
        <PosterRow
          title="Clássicos do cinema"
          movies={classics}
          direction={-1}
          onSelectMovie={onSelectMovie}
        />
      )}
    </div>
  );
}

// Rola sozinho em loop contínuo; pausa quando o mouse está em cima ou o usuário
// interage (arrastar/scroll/toque) e retoma pouco depois. `direction`: 1 = pra
// esquerda, -1 = pra direita.
const SCROLL_SPEED = 0.4;

function useAutoScroll(ref: React.RefObject<HTMLDivElement | null>, direction: number): void {
  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    let paused = false;
    let frame = 0;
    let resumeTimer: ReturnType<typeof setTimeout>;

    const tick = (): void => {
      const half = el.scrollWidth / 2; // a lista é duplicada pro loop sem emenda
      if (!paused && half > 0 && el.scrollWidth > el.clientWidth) {
        // Ao chegar na borda, salta a metade equivalente (conteúdo idêntico → invisível).
        if (direction < 0 && el.scrollLeft <= SCROLL_SPEED) {
          el.scrollLeft += half;
        }
        el.scrollLeft += SCROLL_SPEED * direction;
        if (direction > 0 && el.scrollLeft >= half) {
          el.scrollLeft -= half;
        }
      }
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    const pause = (): void => {
      paused = true;
      clearTimeout(resumeTimer);
    };
    const resumeSoon = (): void => {
      clearTimeout(resumeTimer);
      resumeTimer = setTimeout(() => {
        paused = false;
      }, 1200);
    };
    const nudge = (): void => {
      pause();
      resumeSoon();
    };

    el.addEventListener('mouseenter', pause);
    el.addEventListener('mouseleave', resumeSoon);
    el.addEventListener('wheel', nudge, { passive: true });
    el.addEventListener('pointerdown', nudge);
    el.addEventListener('touchstart', nudge, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      clearTimeout(resumeTimer);
      el.removeEventListener('mouseenter', pause);
      el.removeEventListener('mouseleave', resumeSoon);
      el.removeEventListener('wheel', nudge);
      el.removeEventListener('pointerdown', nudge);
      el.removeEventListener('touchstart', nudge);
    };
  }, [ref]);
}

function PosterRow({
  title,
  movies,
  direction,
  onSelectMovie,
}: {
  title: string;
  movies: Movie[];
  direction: number;
  onSelectMovie: (movieId: string) => void;
}): React.JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  useAutoScroll(scrollerRef, direction);

  // Duplicamos a lista pra o loop ficar contínuo (a metade some, volta do início).
  const loop = [...movies, ...movies];

  return (
    <section className="row">
      <h2 className="row-title">{title}</h2>
      <div className="poster-scroller" ref={scrollerRef}>
        {loop.map((movie, index) => (
          <PosterCard
            key={`${movie.id}-${index}`}
            movie={movie}
            onSelect={() => onSelectMovie(movie.id)}
          />
        ))}
      </div>
    </section>
  );
}

function Hero({ movie, onSelect }: { movie: Movie; onSelect: () => void }): React.JSX.Element {
  return (
    <header
      className="hero"
      style={movie.backdropUrl ? { backgroundImage: `url(${movie.backdropUrl})` } : undefined}
    >
      <div className="hero-overlay">
        <div className="hero-content">
          <span className="hero-badge">Em destaque</span>
          <h1 className="hero-title">{movie.title}</h1>
          {movie.tagline && <p className="hero-tagline">{movie.tagline}</p>}
          <div className="meta-row">
            <RatingBadge rating={movie.rating} />
            <span>{movie.year}</span>
            <span>{formatDuration(movie.duration)}</span>
            <span className="score">★ {movie.voteAverage.toFixed(1)}</span>
          </div>
          <button className="btn-primary" onClick={onSelect}>
            Ver sessões
          </button>
        </div>
      </div>
    </header>
  );
}

function PosterCard({ movie, onSelect }: { movie: Movie; onSelect: () => void }): React.JSX.Element {
  return (
    <button className="poster-card" onClick={onSelect} title={movie.title}>
      {movie.posterUrl ? (
        <img className="poster-img" src={movie.posterUrl} alt={movie.title} loading="lazy" />
      ) : (
        <div className="poster-img poster-fallback">{movie.title}</div>
      )}
      <span className="poster-score">★ {movie.voteAverage.toFixed(1)}</span>
      <div className="poster-info">
        <span className="poster-name">{movie.title}</span>
        <span className="poster-sub">
          {movie.year} · {formatDuration(movie.duration)}
        </span>
      </div>
    </button>
  );
}
