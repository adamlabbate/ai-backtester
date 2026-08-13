import { useEffect, useRef } from "react";
import {
  createChart,
  CandlestickSeries,
  createSeriesMarkers,
  ColorType,
  type IChartApi,
  type ISeriesApi,
  type ISeriesMarkersPluginApi,
  type SeriesMarker,
  type Time,
  type UTCTimestamp,
} from "lightweight-charts";
import type { Bar, Trade } from "../types";
import styles from "./Chart.module.css";

interface ChartProps {
  bars: Bar[];
  trades: Trade[];
}

export function Chart({ bars, trades }: ChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const markersRef = useRef<ISeriesMarkersPluginApi<Time> | null>(null);

  // Create the chart exactly once, on mount. lightweight-charts is an
  // imperative, canvas-based library -- it doesn't participate in React's
  // virtual DOM at all. We hand it a raw <div> via ref and drive it
  // directly through its own API, same as you would in plain JS. The
  // empty dependency array is what makes this "run once, not on every
  // re-render" -- React effects with `[]` only fire on mount and cleanup
  // only fires on unmount.
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = createChart(container, {
      layout: {
        background: { type: ColorType.Solid, color: "transparent" },
        textColor: "#8890a4",
        fontFamily: "'IBM Plex Mono', monospace",
        fontSize: 12,
        attributionLogo: false,
      },
      grid: {
        vertLines: { color: "#161a24" },
        horzLines: { color: "#161a24" },
      },
      crosshair: {
        vertLine: { color: "#e8a33d", labelBackgroundColor: "#e8a33d", width: 1 },
        horzLine: { color: "#e8a33d", labelBackgroundColor: "#e8a33d", width: 1 },
      },
      rightPriceScale: { borderColor: "#232838" },
      timeScale: { borderColor: "#232838", timeVisible: true, secondsVisible: false },
      autoSize: true,
    });

    const series = chart.addSeries(CandlestickSeries, {
      upColor: "#3ecf8e",
      downColor: "#f0556b",
      borderVisible: false,
      wickUpColor: "#3ecf8e",
      wickDownColor: "#f0556b",
    });

    const markers = createSeriesMarkers(series, []);

    chartRef.current = chart;
    seriesRef.current = series;
    markersRef.current = markers;

    return () => {
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
      markersRef.current = null;
    };
  }, []);

  // Push new data whenever `bars`/`trades` change, without touching the
  // chart instance itself -- recreating the chart on every data refresh
  // would reset the user's zoom/pan position each time they ran a new
  // backtest, which would feel broken.
  useEffect(() => {
    const series = seriesRef.current;
    const markers = markersRef.current;
    if (!series || !markers) return;

    series.setData(
      bars.map((bar) => ({
        time: bar.time as UTCTimestamp,
        open: bar.open,
        high: bar.high,
        low: bar.low,
        close: bar.close,
      })),
    );

    // Two markers per trade: an amber arrow where the strategy fired, and
    // a colored dot at exit labeled with the R-multiple outcome -- the
    // same number the trade list and equity curve are built from, so the
    // chart can never tell a different story than the stats below it.
    //
    // Entry markers deliberately carry no text: with more than a handful
    // of trades, a full reason string ("fast MA crossed above slow MA")
    // repeated at every arrow overlaps into an unreadable smear. The full
    // reason is one scroll away in the trade list below; the chart only
    // needs to show *where*, not *why*.
    const tradeMarkers: SeriesMarker<Time>[] = trades.flatMap((trade) => {
      const isLong = trade.direction === "long";
      const won = trade.r_multiple > 0;
      return [
        {
          time: trade.entry_time as UTCTimestamp,
          position: isLong ? "belowBar" : "aboveBar",
          shape: isLong ? "arrowUp" : "arrowDown",
          color: "#e8a33d",
        },
        {
          time: trade.exit_time as UTCTimestamp,
          position: isLong ? "aboveBar" : "belowBar",
          shape: "circle",
          color: won ? "#3ecf8e" : "#f0556b",
          text: `${trade.r_multiple >= 0 ? "+" : ""}${trade.r_multiple.toFixed(1)}R`,
        },
      ];
    });

    markers.setMarkers(tradeMarkers);
    chartRef.current?.timeScale().fitContent();
  }, [bars, trades]);

  return <div ref={containerRef} className={styles.chart} />;
}
