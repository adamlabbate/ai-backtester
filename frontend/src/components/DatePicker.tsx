import { useEffect, useRef, useState } from "react";
import { parseISODate, formatISODate } from "../dateUtils";
import styles from "./DatePicker.module.css";

interface DatePickerProps {
  label: string;
  value: string; // "YYYY-MM-DD"
  onChange: (value: string) => void;
  min?: string; // "YYYY-MM-DD", inclusive
  max?: string; // "YYYY-MM-DD", inclusive
  disableWeekends?: boolean;
}

const WEEKDAY_HEADERS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function formatDisplay(s: string): string {
  return parseISODate(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

// 42 cells (6 full weeks) covering the target month, including the
// leading/trailing days from adjacent months that fill out the grid --
// standard calendar-widget layout.
function getMonthGrid(year: number, month: number): Date[] {
  const firstOfMonth = new Date(year, month, 1);
  const gridStart = new Date(year, month, 1 - firstOfMonth.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + i));
}

function isDateDisabled(d: Date, min: string | undefined, max: string | undefined, disableWeekends: boolean | undefined): boolean {
  const iso = formatISODate(d);
  if (min !== undefined && iso < min) return true;
  if (max !== undefined && iso > max) return true;
  if (disableWeekends && (d.getDay() === 0 || d.getDay() === 6)) return true;
  return false;
}

export function DatePicker({ label, value, onChange, min, max, disableWeekends }: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewDate, setViewDate] = useState(() => parseISODate(value));
  const wrapperRef = useRef<HTMLDivElement>(null);

  // Click-outside-to-close: only listens while the popover is actually
  // open, so this never adds overhead to the common case.
  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  function handleOpen() {
    setViewDate(parseISODate(value)); // jump back to the selected month each time it opens
    setOpen(true);
  }

  function handleSelect(d: Date) {
    onChange(formatISODate(d));
    setOpen(false);
  }

  const selected = parseISODate(value);
  const today = new Date();
  const grid = getMonthGrid(viewDate.getFullYear(), viewDate.getMonth());
  const monthLabel = viewDate.toLocaleDateString(undefined, { month: "long", year: "numeric" });

  return (
    <div className={styles.field} ref={wrapperRef}>
      <span className={styles.label}>{label}</span>
      <button type="button" className={styles.trigger} onClick={() => (open ? setOpen(false) : handleOpen())}>
        {formatDisplay(value)}
      </button>

      {open && (
        <div className={styles.popover} role="dialog" aria-label={`${label} calendar`}>
          <div className={styles.header}>
            <button
              type="button"
              className={styles.navButton}
              aria-label="Previous month"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
            >
              ‹
            </button>
            <span className={styles.monthLabel}>{monthLabel}</span>
            <button
              type="button"
              className={styles.navButton}
              aria-label="Next month"
              onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
            >
              ›
            </button>
          </div>

          <div className={styles.weekdayRow}>
            {WEEKDAY_HEADERS.map((w) => (
              <span key={w} className={styles.weekdayCell}>
                {w}
              </span>
            ))}
          </div>

          <div className={styles.dayGrid}>
            {grid.map((d) => {
              const inMonth = d.getMonth() === viewDate.getMonth();
              const disabled = isDateDisabled(d, min, max, disableWeekends);
              const isSelected = isSameDay(d, selected);
              const isToday = isSameDay(d, today);
              const classes = [styles.dayCell];
              if (!inMonth) classes.push(styles.dayCellOutside);
              if (disabled) classes.push(styles.dayCellDisabled);
              if (isSelected) classes.push(styles.dayCellSelected);
              if (isToday && !isSelected) classes.push(styles.dayCellToday);
              return (
                <button
                  type="button"
                  key={d.toISOString()}
                  className={classes.join(" ")}
                  disabled={disabled}
                  onClick={() => handleSelect(d)}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
