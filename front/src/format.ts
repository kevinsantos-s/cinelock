export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) return `${rest}min`;
  return rest === 0 ? `${hours}h` : `${hours}h${String(rest).padStart(2, '0')}`;
}

// "Livre" fica melhor que "L" no selo de classificação.
export function formatRating(rating: string): string {
  return rating === 'L' ? 'Livre' : `${rating} anos`;
}

// Cor do selo de classificação seguindo o padrão brasileiro (verde → vermelho).
export function ratingColor(rating: string): string {
  switch (rating) {
    case 'L':
      return '#3fa34d';
    case '10':
      return '#1f7bd6';
    case '12':
      return '#f5c518';
    case '14':
      return '#f08a24';
    case '16':
      return '#d64545';
    default:
      return '#111';
  }
}

const DAY_LABEL = new Intl.DateTimeFormat('pt-BR', { weekday: 'short', day: '2-digit', month: '2-digit' });
const TIME_LABEL = new Intl.DateTimeFormat('pt-BR', { hour: '2-digit', minute: '2-digit' });

export function formatDayKey(iso: string): string {
  return iso.slice(0, 10);
}

export function formatDayLabel(iso: string): string {
  const label = DAY_LABEL.format(new Date(iso));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function formatTime(iso: string): string {
  return TIME_LABEL.format(new Date(iso));
}
