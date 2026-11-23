import { describe, expect, it } from 'vitest';
import { addDays, type Entry, type Weight } from '../../src/domain/nutrition';
import { advise, fiberTarget, forecast, paceKcal, planWeeks, realNeed, trend, waterTarget, weekBalance } from '../../src/domain/progress';

/* Reference values from an independent Python calculation (see the comments). */
const T = '2026-11-23';
// a weigh-in every second day for 40 days, falling 0.065 kg a day: 78 kg today, 80.6 kg 40 days ago
const series = (perDay: number): Weight[] => Array.from({ length: 21 }, (_, i) => { const o = -40 + i * 2; return { date: addDays(T, o), kg: 78 - perDay * o }; });
const food = (days: number, kcal: number, skip: number[] = []): Entry[] => Array.from({ length: days }, (_, i) => i).filter(i => !skip.includes(i)).map(i => ({ id: 'e' + i, date: addDays(T, -i), meal: 'lunch', productId: 'q', name: 'q', grams: 100, per100: { kcal, p: 0, f: 0, c: 0 }, at: 0 }));

describe('pace and plan', () => {
  it('moderate pace at 80 kg: 0.4 kg a week = 440 kcal a day', () => {
    // 80 * 0.005 = 0.4 kg; 0.4 * 7700 / 7 = 440
    expect(paceKcal(80, { targetKg: 75, pace: 'mod', setAt: T })).toBe(-440);
    expect(paceKcal(70, { targetKg: 75, pace: 'slow', setAt: T })).toBe(190);   // 70 * 0.0025 * 7700 / 7 = 192.5 -> 190
    expect(planWeeks(80, { targetKg: 75, pace: 'mod', setAt: T })).toBe(12.5);
  });
});

describe('trend and forecast', () => {
  it('the slope of the 7-day average is the real rate', () => {
    expect(trend(series(0.065), T)!.slope).toBeCloseTo(-0.065, 6);
  });
  it('too few weigh-ins give no trend', () => { expect(trend(series(0.065).slice(-3), T)).toBeNull(); });
  it('goal 75 kg: average 78.195, 0.455 kg a week -> 49 days, range 40-63 days', () => {
    const f = forecast(series(0.065), T, 75); expect(f).toMatchObject({ kind: 'date', date: '2027-01-11', early: '2027-01-02', late: '2027-01-25' }); expect((f as { perWeek: number }).perWeek).toBeCloseTo(-0.455, 1);
  });
  it('moving away from the goal and a flat weight are said as such', () => {
    expect(forecast(series(0.065), T, 82).kind).toBe('away');
    expect(forecast(series(0.002), T, 75).kind).toBe('flat');
  });
});

describe('advice', () => {
  const g = { targetKg: 75, pace: 'mod' as const, setAt: T };
  it('0.58 % a week on a 0.5 % plan is fine', () => { expect(advise(series(0.065), food(14, 2100), T, g)!.kind).toBe('ok'); });
  it('1.4 kg a week is too fast: suggests +200 kcal', () => { const a = advise(series(0.2), food(14, 1500), T, g)!; expect([a.kind, a.deltaKcal]).toEqual(['fast', 200]); });
  it('0.1 kg a week is too slow: suggests -150 kcal', () => { const a = advise(series(0.015), food(14, 2300), T, g)!; expect([a.kind, a.deltaKcal]).toEqual(['slow', -150]); });
  it('a flat weight', () => { expect(advise(series(0.002), food(14, 2300), T, g)!.kind).toBe('flat'); });
  it('fewer than 10 of 14 days filled: unsure, no suggestion', () => { const a = advise(series(0.002), food(14, 2300, [1, 2, 3, 4, 5]), T, g)!; expect([a.kind, a.deltaKcal, a.filled]).toEqual(['unsure', 0, 9]); });
  it('no goal, no advice', () => { expect(advise(series(0.065), food(14, 2100), T, null)).toBeNull(); });
});

describe('real need, week balance, guidance', () => {
  it('2000 kcal a day while losing 0.065 kg a day: 2000 + 0.065 * 7700 = 2500', () => { expect(realNeed(series(0.065), food(21, 2000), T)).toEqual({ kcal: 2500, filled: 21 }); });
  it('needs 14 filled days of 21', () => { expect(realNeed(series(0.065), food(21, 2000, [1, 2, 3, 4, 5, 6, 7, 8]), T)).toBeNull(); });
  it('week balance counts filled days only: 5 days, +120 kcal', () => {
    const es = [2300, 2100, 2170, 2000, 2400].map((k, i) => ({ id: 'w' + i, date: addDays(T, -[0, 1, 3, 4, 6][i]!), meal: 'l', productId: 'q', name: 'q', grams: 100, per100: { kcal: k, p: 0, f: 0, c: 0 }, at: 0 }));
    expect(weekBalance(es, T, 2170)).toEqual({ delta: 120, filled: 5 });
  });
  it('fibre 14 g per 1000 kcal, water 30 ml per kg to 250 ml', () => { expect([fiberTarget(2170), waterTarget(80), waterTarget(62)]).toEqual([30, 2500, 1750]); });
});
