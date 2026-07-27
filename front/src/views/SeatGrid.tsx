import { Fragment } from 'react';
import type { SeatStatus } from '../api';

type SeatGridProps = {
  seats: SeatStatus[];
  renderSeat: (seat: SeatStatus) => React.ReactNode;
};

// Corredor no meio da fileira (depois do 5º assento), pra sala não parecer um bloco.
const AISLE_AFTER = 5;

// Agrupa os assentos por fileira (letra) e desenha cada linha com a letra nas
// laterais e um corredor no meio — layout de cinema de verdade.
export function SeatGrid({ seats, renderSeat }: SeatGridProps): React.JSX.Element {
  const rows = new Map<string, SeatStatus[]>();
  for (const seat of seats) {
    const rowLabel = seat.seat.charAt(0);
    const rowSeats = rows.get(rowLabel) ?? [];
    rowSeats.push(seat);
    rows.set(rowLabel, rowSeats);
  }

  return (
    <div className="seat-grid">
      {[...rows.entries()].map(([rowLabel, rowSeats]) => (
        <div className="seat-row" key={rowLabel}>
          <span className="seat-row-label">{rowLabel}</span>
          {rowSeats.map((seat, index) => (
            <Fragment key={seat.seat}>
              {index === AISLE_AFTER && <span className="seat-aisle" aria-hidden="true" />}
              {renderSeat(seat)}
            </Fragment>
          ))}
          <span className="seat-row-label">{rowLabel}</span>
        </div>
      ))}
    </div>
  );
}
