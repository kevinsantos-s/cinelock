import { useCallback, useEffect, useRef, useState } from 'react';
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

      <PosterRow title="Em cartaz" movies={movies} onSelectMovie={onSelectMovie} />

      {classics.length > 2 && (
        <PosterRow title="Clássicos do cinema" movies={classics} onSelectMovie={onSelectMovie} />
      )}
    </div>
  );
}

function PosterRow({
  title,
  movies,
  onSelectMovie,
}: {
  title: string;
  movies: Movie[];
  onSelectMovie: (movieId: string) => void;
}): React.JSX.Element {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // Habilita/desabilita as setas conforme a posição do scroll.
  const updateEdges = useCallback((): void => {
    const el = scrollerRef.current;
    if (!el) return;
    setAtStart(el.scrollLeft <= 1);
    setAtEnd(el.scrollLeft + el.clientWidth >= el.scrollWidth - 1);
  }, []);

  useEffect(() => {
    updateEdges();
  }, [movies, updateEdges]);

  const scrollByPage = (dir: number): void => {
    const el = scrollerRef.current;
    if (!el) return;
    // Rola ~80% da largura visível, suave — no mobile o arraste nativo faz o resto.
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <section className="row">
      <h2 className="row-title">{title}</h2>
      <div className="row-rail">
        <button
          className="rail-arrow rail-arrow--left"
          onClick={() => scrollByPage(-1)}
          disabled={atStart}
          aria-label="Filmes anteriores"
        >
          ‹
        </button>
        <div className="poster-scroller" ref={scrollerRef} onScroll={updateEdges}>
          {movies.map((movie) => (
            <PosterCard key={movie.id} movie={movie} onSelect={() => onSelectMovie(movie.id)} />
          ))}
        </div>
        <button
          className="rail-arrow rail-arrow--right"
          onClick={() => scrollByPage(1)}
          disabled={atEnd}
          aria-label="Próximos filmes"
        >
          ›
        </button>
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
