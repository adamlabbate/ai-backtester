import type { Trade } from "../types";
import styles from "./TradeList.module.css";

interface TradeListProps {
  trades: Trade[];
}

function formatDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" });
}

// The signature visual for this table: R-multiple isn't just a number here,
// it's a small diverging bar centered on zero -- red extends left for a
// loss, green extends right for a win, both scaled against the biggest
// |R| in the list so bar lengths are comparable row to row. R-multiples
// are the actual currency this system trades in (see TradeManager in the
// backend), so giving them a dedicated visual felt more honest than
// burying them in a plain number column.
function RBar({ rMultiple, maxAbsR }: { rMultiple: number; maxAbsR: number }) {
  const pct = Math.min(50, (Math.abs(rMultiple) / maxAbsR) * 50);
  const isPositive = rMultiple >= 0;
  return (
    <div className={styles.rCell}>
      <div className={styles.rBarTrack}>
        <div className={styles.rBarCenter} />
        <div
          className={isPositive ? styles.rBarPositive : styles.rBarNegative}
          style={isPositive ? { left: "50%", width: `${pct}%` } : { right: "50%", width: `${pct}%` }}
        />
      </div>
      <span className={isPositive ? styles.rTextPositive : styles.rTextNegative}>
        {isPositive ? "+" : ""}
        {rMultiple.toFixed(2)}R
      </span>
    </div>
  );
}

export function TradeList({ trades }: TradeListProps) {
  if (trades.length === 0) {
    return <div className={styles.empty}>No trades triggered in this range.</div>;
  }

  const maxAbsR = Math.max(1, ...trades.map((t) => Math.abs(t.r_multiple)));

  return (
    <div className={styles.wrapper}>
      <table className={styles.table}>
        <thead>
          <tr>
            <th>Dir</th>
            <th>Entry</th>
            <th>Exit</th>
            <th>Entry date</th>
            <th>Exit date</th>
            <th>R-multiple</th>
            <th>P&amp;L</th>
            <th>Reason</th>
          </tr>
        </thead>
        <tbody>
          {trades.map((trade, i) => (
            <tr key={i}>
              <td className={trade.direction === "long" ? styles.long : styles.short}>
                {trade.direction === "long" ? "LONG" : "SHORT"}
              </td>
              <td className={styles.num}>{trade.entry_price.toFixed(2)}</td>
              <td className={styles.num}>{trade.exit_price.toFixed(2)}</td>
              <td className={styles.num}>{formatDate(trade.entry_time)}</td>
              <td className={styles.num}>{formatDate(trade.exit_time)}</td>
              <td>
                <RBar rMultiple={trade.r_multiple} maxAbsR={maxAbsR} />
              </td>
              <td className={`${styles.num} ${trade.pnl >= 0 ? styles.long : styles.short}`}>
                {trade.pnl >= 0 ? "+" : ""}
                {trade.pnl.toLocaleString(undefined, { style: "currency", currency: "USD" })}
              </td>
              <td className={styles.reason}>{trade.reason}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
