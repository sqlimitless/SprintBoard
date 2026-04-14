// Date helpers for the sprint timeline / gantt strip.

const DAY_MS = 24 * 60 * 60 * 1000;

export function parseDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function toDateOnly(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((toDateOnly(b).getTime() - toDateOnly(a).getTime()) / DAY_MS);
}

export function formatShortDate(iso: string | null | undefined): string {
  const d = parseDate(iso);
  if (!d) return "—";
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  if (!start && !end) return "기간 미정";
  return `${formatShortDate(start)} ~ ${formatShortDate(end)}`;
}

// Position a bar within [rangeStart, rangeEnd] as percent offsets.
// Returns null if the bar has no overlap with the range or if dates are missing.
export function barPosition(
  rangeStart: Date,
  rangeEnd: Date,
  barStart: Date | null,
  barEnd: Date | null,
): { leftPct: number; widthPct: number } | null {
  if (!barStart && !barEnd) return null;
  const bs = barStart ?? barEnd!;
  const be = barEnd ?? barStart!;
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);
  const startOffset = Math.max(0, daysBetween(rangeStart, bs));
  const endOffset = Math.min(totalDays, daysBetween(rangeStart, be) + 1);
  if (endOffset <= 0 || startOffset >= totalDays) return null;
  const leftPct = (startOffset / totalDays) * 100;
  const widthPct = Math.max(1, ((endOffset - startOffset) / totalDays) * 100);
  return { leftPct, widthPct };
}

export function todayMarkerPct(rangeStart: Date, rangeEnd: Date): number | null {
  const today = toDateOnly(new Date());
  const totalDays = Math.max(1, daysBetween(rangeStart, rangeEnd) + 1);
  const offset = daysBetween(rangeStart, today);
  if (offset < 0 || offset > totalDays) return null;
  return (offset / totalDays) * 100;
}

// Ratio (0..1) of today's position between start and due. Returns null if
// either endpoint is missing or start is after due.
export function progressRatio(
  start: string | null,
  due: string | null,
): number | null {
  const s = parseDate(start);
  const d = parseDate(due);
  if (!s || !d) return null;
  const total = daysBetween(s, d);
  if (total <= 0) return null;
  const elapsed = daysBetween(s, new Date());
  return Math.max(0, Math.min(1, elapsed / total));
}
