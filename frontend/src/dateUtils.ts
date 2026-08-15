// Local-time date helpers, all operating on "YYYY-MM-DD" strings.
//
// `new Date(isoString)` parses an ISO date as UTC midnight, which renders
// as the *previous* day in any timezone behind UTC (all of the US) --
// everything here goes through component-based construction
// (`new Date(y, m-1, d)`) instead, which is local-time and avoids that
// off-by-one entirely.

export function parseISODate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function formatISODate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function todayISO(): string {
  return formatISODate(new Date());
}

// Adds `delta` days (negative to subtract) to an ISO date string.
export function addDaysISO(base: string, delta: number): string {
  const d = parseISODate(base);
  d.setDate(d.getDate() + delta);
  return formatISODate(d);
}
