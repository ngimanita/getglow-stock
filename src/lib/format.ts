// Thai-locale formatting helpers. Values and behavior are ported verbatim from
// the design prototype's logic class (GETGLOW Stock.dc.html) — do not "improve"
// the rounding/format rules without re-checking the prototype.

const THAI_MONTHS = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
];

/** Thai-style Buddhist-era date, 2-digit year: "29 ส.ค. 69" */
export function formatThaiDate(d: Date): string {
  const yy = String(d.getFullYear() + 543).slice(2);
  return `${d.getDate()} ${THAI_MONTHS[d.getMonth()]} ${yy}`;
}

/** Comma-thousands number. Default: 0-1 decimals (trailing zero dropped). */
export function formatNumber(v: number | null | undefined, dp?: number): string {
  const n = Number(v) || 0;
  return n.toLocaleString('en-US', {
    minimumFractionDigits: dp || 0,
    maximumFractionDigits: dp === undefined ? 1 : dp,
  });
}

/** "1,234.50 ฿" */
export function formatBaht(v: number | null | undefined, dp?: number): string {
  return `${formatNumber(v, dp)} ฿`;
}

/** ISO date string (YYYY-MM-DD) in local time, no UTC shift. */
export function toISODate(d: Date): string {
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

/** Parse a YYYY-MM-DD (or Date) into a local-midnight Date, matching the prototype's D(). */
export function parseLocalDate(s: string | Date): Date {
  if (s instanceof Date) return new Date(s.getFullYear(), s.getMonth(), s.getDate());
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

/** Whole days between two dates (b - a), rounded — matches the prototype's days(). */
export function daysBetween(a: Date, b: Date): number {
  return Math.round((b.getTime() - a.getTime()) / 86400000);
}

export function addDays(d: Date, n: number): Date {
  return new Date(d.getTime() + n * 86400000);
}
