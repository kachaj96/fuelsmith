/* Weight goal, forecast, pace advice, the real energy need and the week balance. Pure functions, unit tested with values worked out by hand.
   Everything here is an estimate; the app says so and never acts on it by itself. */
import { addDays, avg7, entryMacros, r1, type Entry, type Weight } from './nutrition';

export type Pace = 'slow' | 'mod' | 'fast';
/** Planned change per week as a fraction of body weight. */
export const PACE_PCT: Record<Pace, number> = { slow: 0.0025, mod: 0.005, fast: 0.01 };
export const KCAL_PER_KG = 7700;
export interface WeightGoal { targetKg: number; pace: Pace; setAt: string }

const dn = (d: string): number => Math.round(Date.UTC(+d.slice(0, 4), +d.slice(5, 7) - 1, +d.slice(8, 10)) / 864e5);
/** Daily energy change for a planned pace: kg per week * 7700 / 7, negative when losing. */
export function paceKcal(currentKg: number, g: WeightGoal): number {
  const dir = Math.sign(g.targetKg - currentKg); if (!dir) return 0;
  return Math.round((dir * currentKg * PACE_PCT[g.pace] * KCAL_PER_KG) / 7 / 10) * 10;
}
export function planWeeks(currentKg: number, g: WeightGoal): number { const rate = currentKg * PACE_PCT[g.pace]; return rate ? Math.abs(g.targetKg - currentKg) / rate : 0; }

/** Least-squares slope of the 7-day average over the last `window` days, in kg per day. Needs 4 weigh-ins over at least 10 days. */
export function trend(ws: Weight[], today: string, window = 28): { slope: number; avg: number; n: number; span: number } | null {
  const from = addDays(today, -(window - 1)); const xs = ws.filter(w => w.date >= from && w.date <= today).sort((a, b) => a.date.localeCompare(b.date));
  if (xs.length < 4) return null; const span = dn(xs[xs.length - 1]!.date) - dn(xs[0]!.date); if (span < 10) return null;
  const pts = xs.map(w => [dn(w.date), avg7(ws, w.date, false)!] as const);   // unrounded: rounding to 0.1 kg bends the slope
  const mx = pts.reduce((a, p) => a + p[0], 0) / pts.length, my = pts.reduce((a, p) => a + p[1], 0) / pts.length;
  const num = pts.reduce((a, p) => a + (p[0] - mx) * (p[1] - my), 0), den = pts.reduce((a, p) => a + (p[0] - mx) ** 2, 0);
  return { slope: den ? num / den : 0, avg: avg7(ws, today, false) ?? xs[xs.length - 1]!.kg, n: xs.length, span };
}
export type Forecast = { kind: 'date'; date: string; early: string; late: string; perWeek: number } | { kind: 'away'; perWeek: number } | { kind: 'flat'; perWeek: number } | { kind: 'reached' } | { kind: 'noData' };
/** When the goal is reached at the current pace, with a range of +-0.1 kg per week. */
export function forecast(ws: Weight[], today: string, targetKg: number): Forecast {
  const t = trend(ws, today); if (!t) return { kind: 'noData' };
  const left = targetKg - t.avg; const perWeek = Math.round(t.slope * 7 * 100) / 100;
  if (Math.abs(left) < 0.2) return { kind: 'reached' };
  if (Math.abs(t.slope * 7) < 0.05) return { kind: 'flat', perWeek };
  if (Math.sign(left) !== Math.sign(t.slope)) return { kind: 'away', perWeek };
  const days = (w: number) => Math.round((Math.abs(left) / w) * 7);
  const v = Math.abs(t.slope * 7);
  return { kind: 'date', date: addDays(today, days(v)), early: addDays(today, days(v + 0.1)), late: addDays(today, days(Math.max(0.05, v - 0.1))), perWeek };
}

/** Days with at least one food entry among the `n` days ending on `today`. A day without entries is unknown, not zero. */
export function filledDays(es: Entry[], today: string, n: number): string[] { const from = addDays(today, -(n - 1)); return [...new Set(es.filter(e => e.date >= from && e.date <= today).map(e => e.date))].sort(); }
export function dayKcal(es: Entry[], date: string): number { return es.filter(e => e.date === date).reduce((a, e) => a + entryMacros(e).kcal, 0); }

export type AdviceKind = 'fast' | 'slow' | 'flat' | 'ok' | 'unsure';
export interface Advice { kind: AdviceKind; pctPerWeek: number; kgPerWeek: number; filled: number; of: number; deltaKcal: number }
/** Looks at the last 14 days only. Suggestions are numbers to show, never to apply without a tap. */
export function advise(ws: Weight[], es: Entry[], today: string, g: WeightGoal | null): Advice | null {
  const t = trend(ws, today, 21); if (!t || !g) return null;
  const kgw = t.slope * 7; const pct = (kgw / t.avg) * 100; const filled = filledDays(es, today, 14).length;
  const losing = g.targetKg < t.avg; const plan = PACE_PCT[g.pace] * 100;
  const base = { pctPerWeek: r1(pct * 100) / 100, kgPerWeek: r1(kgw * 100) / 100, filled, of: 14 };
  if (filled < 10) return { kind: 'unsure', ...base, deltaKcal: 0 };
  const toward = losing ? -pct : pct;   // progress toward the goal, % per week
  if (Math.abs(kgw) < 0.05) return { kind: 'flat', ...base, deltaKcal: losing ? -150 : 150 };
  if (toward > Math.max(1, plan * 2)) return { kind: 'fast', ...base, deltaKcal: losing ? 200 : -150 };
  if (toward < plan / 2) return { kind: 'slow', ...base, deltaKcal: losing ? -150 : 150 };
  return { kind: 'ok', ...base, deltaKcal: 0 };
}

/** The energy that keeps the weight: what was eaten on filled days minus the energy stored or lost (kg change * 7700 / days).
    Needs 21 days with at least 14 filled and a weight trend. */
export function realNeed(ws: Weight[], es: Entry[], today: string): { kcal: number; filled: number } | null {
  const days = 21; const f = filledDays(es, today, days); if (f.length < 14) return null;
  const t = trend(ws, today, days); if (!t) return null;
  const eaten = f.reduce((a, d) => a + dayKcal(es, d), 0) / f.length;
  return { kcal: Math.round((eaten - t.slope * KCAL_PER_KG) / 10) * 10, filled: f.length };
}
/** Sum of (eaten - target) over the filled days of the last 7, and how many days that is. */
export function weekBalance(es: Entry[], today: string, targetKcal: number): { delta: number; filled: number } {
  const f = filledDays(es, today, 7); return { delta: f.reduce((a, d) => a + dayKcal(es, d) - targetKcal, 0), filled: f.length };
}
/** Fibre guidance: 14 g per 1000 kcal (a common dietary guideline), rounded. */
export const fiberTarget = (kcal: number): number => Math.round((kcal / 1000) * 14);
/** Water guidance: 30 ml per kg, rounded to 250 ml. */
export const waterTarget = (kg: number): number => Math.round((kg * 30) / 250) * 250;
