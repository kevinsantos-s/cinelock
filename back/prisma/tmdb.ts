// Busca dados de filmes no TMDB pra popular o catálogo no seed.
// Usado só em desenvolvimento (prisma db seed); o token vem do .env.

const TMDB_BASE = 'https://api.themoviedb.org/3';
const IMAGE_BASE = 'https://image.tmdb.org/t/p';

// Tamanhos do CDN do TMDB: pôster em w500 já fica nítido no card; backdrop largo pro banner.
const POSTER_SIZE = 'w500';
const BACKDROP_SIZE = 'w1280';

export type TmdbMovie = {
  tmdbId: number;
  title: string;
  duration: number;
  synopsis: string;
  tagline: string | null;
  posterUrl: string | null;
  backdropUrl: string | null;
  genre: string;
  rating: string;
  year: number;
  voteAverage: number;
};

type SearchResult = {
  results: Array<{ id: number; title: string; release_date?: string }>;
};

type MovieDetails = {
  id: number;
  title: string;
  runtime: number | null;
  overview: string;
  tagline: string;
  poster_path: string | null;
  backdrop_path: string | null;
  genres: Array<{ name: string }>;
  release_date: string;
  vote_average: number;
  release_dates: {
    results: Array<{
      iso_3166_1: string;
      release_dates: Array<{ certification: string; type: number }>;
    }>;
  };
};

function authHeaders(token: string): HeadersInit {
  return { Authorization: `Bearer ${token}`, accept: 'application/json' };
}

async function tmdbGet<T>(path: string, token: string): Promise<T> {
  const separator = path.includes('?') ? '&' : '?';
  const response = await fetch(`${TMDB_BASE}${path}${separator}language=pt-BR`, {
    headers: authHeaders(token),
  });
  if (!response.ok) {
    throw new Error(`TMDB ${path} respondeu ${response.status}`);
  }
  return (await response.json()) as T;
}

function imageUrl(path: string | null, size: string): string | null {
  return path ? `${IMAGE_BASE}/${size}${path}` : null;
}

// Classificação indicativa brasileira; TMDB usa "" pra "Livre", que normalizamos pra "L".
function brazilianRating(details: MovieDetails): string {
  const br = details.release_dates.results.find((entry) => entry.iso_3166_1 === 'BR');
  const certification = br?.release_dates.find((entry) => entry.certification !== '')?.certification;
  return certification ?? 'L';
}

async function fetchByTitle(title: string, token: string): Promise<TmdbMovie> {
  const search = await tmdbGet<SearchResult>(
    `/search/movie?query=${encodeURIComponent(title)}`,
    token,
  );
  const first = search.results[0];
  if (!first) {
    throw new Error(`Nenhum filme encontrado no TMDB para "${title}"`);
  }

  const details = await tmdbGet<MovieDetails>(
    `/movie/${first.id}?append_to_response=release_dates`,
    token,
  );

  return {
    tmdbId: details.id,
    title: details.title,
    duration: details.runtime ?? 120,
    synopsis: details.overview || 'Sinopse indisponível.',
    tagline: details.tagline || null,
    posterUrl: imageUrl(details.poster_path, POSTER_SIZE),
    backdropUrl: imageUrl(details.backdrop_path, BACKDROP_SIZE),
    genre: details.genres.map((entry) => entry.name).join(', ') || 'Diversos',
    rating: brazilianRating(details),
    year: details.release_date ? Number(details.release_date.slice(0, 4)) : 0,
    voteAverage: Math.round(details.vote_average * 10) / 10,
  };
}

// Busca os filmes em série (o TMDB é rápido e evitamos rate-limit de graça).
export async function fetchMovies(titles: readonly string[], token: string): Promise<TmdbMovie[]> {
  const movies: TmdbMovie[] = [];
  for (const title of titles) {
    const movie = await fetchByTitle(title, token);
    movies.push(movie);
    console.log(`  ✓ ${movie.title} (${movie.year})`);
  }
  return movies;
}
