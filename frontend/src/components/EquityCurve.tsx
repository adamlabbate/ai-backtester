import { ResponsiveContainer, AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ReferenceLine } from "recharts";
import type { EquityPoint } from "../types";
import styles from "./EquityCurve.module.css";

interface EquityCurveProps {
  points: EquityPoint[];
  initialEquity: number;
}

function formatDate(seconds: number): string {
  return new Date(seconds * 1000).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "2-digit",
  });
}

export function EquityCurve({ points, initialEquity }: EquityCurveProps) {
  return (
    <div className={styles.card}>
      <span className={styles.title}>Equity curve</span>
      <ResponsiveContainer width="100%" height={200}>
        <AreaChart data={points} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
          <defs>
            <linearGradient id="equityFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#e8a33d" stopOpacity={0.35} />
              <stop offset="100%" stopColor="#e8a33d" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#161a24" vertical={false} />
          <XAxis
            dataKey="time"
            tickFormatter={formatDate}
            stroke="#565d72"
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}
            tickLine={false}
            axisLine={{ stroke: "#232838" }}
            minTickGap={40}
          />
          <YAxis
            stroke="#565d72"
            tick={{ fontFamily: "IBM Plex Mono", fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            width={64}
            tickFormatter={(v: number) => `$${Math.round(v).toLocaleString()}`}
          />
          <ReferenceLine y={initialEquity} stroke="#2e3448" strokeDasharray="3 3" />
          <Tooltip
            contentStyle={{
              background: "#171b26",
              border: "1px solid #232838",
              borderRadius: 6,
              fontFamily: "IBM Plex Mono",
              fontSize: 12,
            }}
            labelFormatter={(label) => formatDate(Number(label))}
            formatter={(value) => [
              `$${Number(value).toLocaleString(undefined, { maximumFractionDigits: 0 })}`,
              "Equity",
            ]}
          />
          <Area type="monotone" dataKey="equity" stroke="#e8a33d" strokeWidth={1.5} fill="url(#equityFill)" />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
