import { formatRating, ratingColor } from '../format';

export function RatingBadge({ rating }: { rating: string }): React.JSX.Element {
  return (
    <span className="rating-badge" style={{ background: ratingColor(rating) }}>
      {formatRating(rating)}
    </span>
  );
}
