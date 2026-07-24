import { useEffect, useState } from 'react';
import type { MovieDetail as MovieDetailData, MovieSession } from './api';
import { Checkout } from './views/Checkout';
import { MovieDetail } from './views/MovieDetail';
import { SeatMap } from './views/SeatMap';
import { Ticket } from './views/Ticket';
import { Vitrine } from './views/Vitrine';

// Navegação simples por estado — o app tem poucas telas, não vale trazer react-router.
type Purchase = { session: MovieSession; movieTitle: string; seats: string[] };

type View =
  | { name: 'vitrine' }
  | { name: 'movie'; movieId: string }
  | { name: 'seats'; session: MovieSession; movieTitle: string }
  | { name: 'checkout'; purchase: Purchase }
  | { name: 'ticket'; purchase: Purchase };

type Theme = 'dark' | 'light';

export function App(): React.JSX.Element {
  const [view, setView] = useState<View>({ name: 'vitrine' });
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('cinelock:theme') as Theme | null) ?? 'dark',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cinelock:theme', theme);
  }, [theme]);

  const goHome = () => setView({ name: 'vitrine' });
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <>
      <nav className="topbar">
        <button className="brand" onClick={goHome}>
          CINE<span className="brand-accent">LOCK</span>
        </button>
        <button
          className="theme-toggle"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Ativar modo claro' : 'Ativar modo escuro'}
          title={theme === 'dark' ? 'Modo claro' : 'Modo escuro'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>
      </nav>

      <main className="app-main">
        {view.name === 'vitrine' && (
          <Vitrine onSelectMovie={(movieId) => setView({ name: 'movie', movieId })} />
        )}

        {view.name === 'movie' && (
          <MovieDetail
            movieId={view.movieId}
            onBack={goHome}
            onSelectSession={(session: MovieSession, movie: MovieDetailData) =>
              setView({ name: 'seats', session, movieTitle: movie.title })
            }
          />
        )}

        {view.name === 'seats' && (
          <SeatMap
            session={view.session}
            movieTitle={view.movieTitle}
            onBack={goHome}
            onReserved={(seats) =>
              setView({
                name: 'checkout',
                purchase: { session: view.session, movieTitle: view.movieTitle, seats },
              })
            }
          />
        )}

        {view.name === 'checkout' && (
          <Checkout
            session={view.purchase.session}
            movieTitle={view.purchase.movieTitle}
            seats={view.purchase.seats}
            onConfirmed={() => setView({ name: 'ticket', purchase: view.purchase })}
            onCancel={goHome}
          />
        )}

        {view.name === 'ticket' && (
          <Ticket
            session={view.purchase.session}
            movieTitle={view.purchase.movieTitle}
            seats={view.purchase.seats}
            onFinish={goHome}
          />
        )}
      </main>
    </>
  );
}

function SunIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" />
    </svg>
  );
}

function MoonIcon(): React.JSX.Element {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21 12.8A9 9 0 1 1 11.2 3a7 7 0 0 0 9.8 9.8z" />
    </svg>
  );
}
