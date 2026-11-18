const pad = (n: number) => String(n).padStart(2, '0');

/** YYYY-MM-DD in the viewer's own timezone — "today" means today where you are. */
export const toDay = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const today = () => toDay(new Date());
export const fromDay = (s: string) => {
  const [y, m, d] = s.split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (s: string, n: number) => {
  const d = fromDay(s);
  d.setDate(d.getDate() + n);
  return toDay(d);
};

/** Monday of the week containing `s`. */
export const weekStart = (s: string) => {
  const d = fromDay(s);
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return toDay(d);
};
export const monthStart = (s: string) => s.slice(0, 8) + '01';

export const prettyDay = (s: string) => {
  const t = today();
  if (s === t) return 'Today';
  if (s === addDays(t, -1)) return 'Yesterday';
  return fromDay(s).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' });
};

export type Period = 'today' | 'week' | 'month' | 'all';
export const PERIODS: { id: Period; label: string }[] = [
  { id: 'today', label: 'Day' },
  { id: 'week', label: 'Week' },
  { id: 'month', label: 'Month' },
  { id: 'all', label: 'All time' },
];
export function periodRange(p: Period, anchor: string): [string, string] {
  if (p === 'today') return [anchor, anchor];
  if (p === 'week') return [weekStart(anchor), addDays(weekStart(anchor), 6)];
  if (p === 'month') return [monthStart(anchor), anchor.slice(0, 8) + '31'];
  return ['0000-01-01', '9999-12-31'];
}
