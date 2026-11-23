/* Backup: one JSON file with everything, marked with the app name so a sibling's file is refused. Restore replaces all data in one transaction. */
import type { DayMeals, Entry, Overrides, Product, Profile, Recipe, Water, Weight } from '../domain/nutrition';
import type { WeightGoal } from '../domain/progress';
import { getAll, getMeta, replaceStores, STORES, type StoreName } from './db';

export const SCHEMA = 2;   // 2 (0.4): days, water, weight goal; a schema 1 file still loads
export interface Pending { ean: string; at: number }
export interface BackupData { app: 'fuelsmith'; schema: number; exportedAt: number; profile: Profile | null; overrides: Overrides; settings: Record<string, unknown>;
  products: Product[]; entries: Entry[]; recipes: Recipe[]; weights: Weight[]; pending: Pending[]; days: DayMeals[]; water: Water[]; goal: WeightGoal | null }

export async function exportBackup(db: IDBDatabase): Promise<BackupData> {
  const [products, entries, recipes, weights, pending, days, water, profile, overrides, settings, goal] = await Promise.all([
    getAll<Product>(db, 'products'), getAll<Entry>(db, 'entries'), getAll<Recipe>(db, 'recipes'), getAll<Weight>(db, 'weights'), getAll<Pending>(db, 'pending'), getAll<DayMeals>(db, 'days'), getAll<Water>(db, 'water'),
    getMeta<Profile | null>(db, 'profile', null), getMeta<Overrides>(db, 'overrides', {}), getMeta<Record<string, unknown>>(db, 'settings', {}), getMeta<WeightGoal | null>(db, 'goal', null)]);
  return { app: 'fuelsmith', schema: SCHEMA, exportedAt: Date.now(), profile, overrides, settings, products, entries, recipes, weights, pending, days, water, goal };
}
export type Check = { ok: true; data: BackupData; counts: Record<'products' | 'entries' | 'recipes' | 'weights', number> } | { ok: false; reason: 'json' | 'app' | 'schema' | 'shape' };
const arr = (x: unknown): x is unknown[] => Array.isArray(x);
export function validateBackup(text: string): Check {
  let j: Record<string, unknown>;
  try { j = JSON.parse(text); } catch { return { ok: false, reason: 'json' }; }
  if (!j || j.app !== 'fuelsmith') return { ok: false, reason: 'app' };
  if (typeof j.schema !== 'number' || j.schema > SCHEMA) return { ok: false, reason: 'schema' };
  if (!arr(j.products) || !arr(j.entries) || !arr(j.recipes) || !arr(j.weights)) return { ok: false, reason: 'shape' };
  const okEntry = (e: unknown): boolean => { const x = e as Entry; return !!x && typeof x.id === 'string' && /^\d{4}-\d\d-\d\d$/.test(x.date) && typeof x.grams === 'number' && !!x.per100 && typeof x.per100.kcal === 'number'; };
  if (!(j.entries as unknown[]).every(okEntry)) return { ok: false, reason: 'shape' };
  const data: BackupData = { app: 'fuelsmith', schema: SCHEMA, exportedAt: Number(j.exportedAt) || 0, profile: (j.profile as Profile) ?? null, overrides: (j.overrides as Overrides) ?? {}, settings: (j.settings as Record<string, unknown>) ?? {},
    products: j.products as Product[], entries: j.entries as Entry[], recipes: j.recipes as Recipe[], weights: j.weights as Weight[], pending: arr(j.pending) ? (j.pending as Pending[]) : [],
    days: arr(j.days) ? (j.days as DayMeals[]) : [], water: arr(j.water) ? (j.water as Water[]) : [], goal: (j.goal as WeightGoal) ?? null };
  return { ok: true, data, counts: { products: data.products.length, entries: data.entries.length, recipes: data.recipes.length, weights: data.weights.length } };
}
export async function restoreBackup(db: IDBDatabase, d: BackupData): Promise<void> {
  const meta = [{ key: 'overrides', value: d.overrides }, { key: 'settings', value: d.settings }, ...(d.profile ? [{ key: 'profile', value: d.profile }] : []), ...(d.goal ? [{ key: 'goal', value: d.goal }] : [])];
  const rows: Partial<Record<StoreName, unknown[]>> = { meta, products: d.products, entries: d.entries, recipes: d.recipes, weights: d.weights, pending: d.pending, days: d.days, water: d.water };
  for (const s of STORES) if (!rows[s]) rows[s] = [];
  await replaceStores(db, rows);
}
