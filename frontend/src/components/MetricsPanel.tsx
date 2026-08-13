import type { Metrics } from "../types";
import styles from "./MetricsPanel.module.css";

interface MetricsPanelProps {
  metrics: Metrics;
  finalEquity: number;
}

function formatPct(value: number): string {
  return `${(value * 100).toFixed(1)}%`;
}

function formatR(value: number): string {
  const sign = value >= 0 ? "+" : "";
  return `${sign}${value.toFixed(2)}R`;
}

export function MetricsPanel({ metrics, finalEquity }: MetricsPanelProps) {
  const tiles: { label: string; value: string; tone?: "positive" | "negative" }[] = [
    { label: "Trades", value: String(metrics.total_trades) },
    { label: "Win rate", value: formatPct(metrics.win_rate) },
    {
      label: "Expectancy",
      value: formatR(metrics.expectancy),
      tone: metrics.expectancy >= 0 ? "positive" : "negative",
    },
    {
      label: "Profit factor",
      value: metrics.profit_factor === null ? "—" : metrics.profit_factor.toFixed(2),
      tone: metrics.profit_factor === null || metrics.profit_factor >= 1 ? "positive" : "negative",
    },
    { label: "Max drawdown", value: formatPct(metrics.max_drawdown_pct), tone: "negative" },
    {
      label: "Final equity",
      value: `$${finalEquity.toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
    },
  ];

  return (
    <div className={styles.panel}>
      {tiles.map((tile) => (
        <div key={tile.label} className={styles.tile}>
          <span className={styles.label}>{tile.label}</span>
          <span className={`${styles.value} ${tile.tone ? styles[tile.tone] : ""}`}>{tile.value}</span>
        </div>
      ))}
    </div>
  );
}
