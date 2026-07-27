import { useEffect, useState } from 'react';
import type { MovieDetail as MovieDetailData, MovieSession } from './api';
import { Checkout } from './views/Checkout';
import { DemoConcurrency } from './views/DemoConcurrency';
import { MovieDetail } from './views/MovieDetail';
import { SeatMap } from './views/SeatMap';
import { Ticket } from './views/Ticket';
import { Vitrine } from './views/Vitrine';

// Navegação simples por estado — o app tem poucas telas, não vale trazer react-router.
// `expiresAt` presente quando é uma compra retomada — o checkout usa o tempo restante.
type Purchase = {
  session: MovieSession;
  movieTitle: string;
  seats: string[];
  expiresAt?: string;
};

type View =
  | { name: 'vitrine' }
  | { name: 'movie'; movieId: string }
  | { name: 'seats'; session: MovieSession; movieTitle: string }
  | { name: 'checkout'; purchase: Purchase }
  | { name: 'ticket'; purchase: Purchase }
  | { name: 'demo' };

const DEMO_PATH = '/demo/concurrency';

type Theme = 'dark' | 'light';

export function App(): React.JSX.Element {
  const [view, setView] = useState<View>(() =>
    window.location.pathname.startsWith('/demo') ? { name: 'demo' } : { name: 'vitrine' },
  );
  const [theme, setTheme] = useState<Theme>(
    () => (localStorage.getItem('cinelock:theme') as Theme | null) ?? 'dark',
  );

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('cinelock:theme', theme);
  }, [theme]);

  const goHome = () => {
    window.history.pushState(null, '', '/');
    setView({ name: 'vitrine' });
  };
  const goDemo = () => {
    window.history.pushState(null, '', DEMO_PATH);
    setView({ name: 'demo' });
  };
  const toggleTheme = () => setTheme(theme === 'dark' ? 'light' : 'dark');

  return (
    <>
      <nav className="topbar">
        <button className="brand" onClick={goHome}>
          CINE<span className="brand-accent">LOCK</span>
        </button>
        <button className="nav-demo-link" onClick={goDemo}>
          <FlaskIcon />
          <span>
            demo <span className="nav-demo-accent">concorrência</span>
          </span>
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
            onResume={(seats, expiresAt) =>
              setView({
                name: 'checkout',
                purchase: { session: view.session, movieTitle: view.movieTitle, seats, expiresAt },
              })
            }
          />
        )}

        {view.name === 'checkout' && (
          <Checkout
            session={view.purchase.session}
            movieTitle={view.purchase.movieTitle}
            seats={view.purchase.seats}
            expiresAt={view.purchase.expiresAt}
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

        {view.name === 'demo' && <DemoConcurrency onBack={goHome} />}
      </main>
    </>
  );
}

function FlaskIcon(): React.JSX.Element {
  return (
    <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M10 3v6.5L5.2 17a2 2 0 0 0 1.7 3h10.2a2 2 0 0 0 1.7-3L14 9.5V3" />
      <path d="M7.5 14h9" />
    </svg>
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
