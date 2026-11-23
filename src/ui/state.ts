import type { DayMeals, Entry, Meal, MealDef, Overrides, Product, Profile, Recipe, Water, Weight, Per100, Targets } from '../domain/nutrition';
import { avg7, DEFAULT_MEALS, recipePer100, targets, tdee, MEALS } from '../domain/nutrition';
import { paceKcal, waterTarget, type WeightGoal } from '../domain/progress';
import type { Pending } from '../storage/backup';
import type { OffProduct } from '../domain/off';
import { DEFAULT_FILTERS, fold, type Filters } from '../domain/search';

export type Tab = 'today' | 'products' | 'progress' | 'more';
export type Page =
  | { t: 'add'; meal: Meal }
  | { t: 'item'; kind: 'product' | 'recipe'; id: string; meal: Meal; grams?: number; entryId?: string }
  | { t: 'form'; id?: string; ean?: string; meal?: Meal; reason?: 'notFound' | 'incomplete' | 'manual' }
  | { t: 'code'; meal: Meal }
  | { t: 'recipe'; id?: string }
  | { t: 'pickIng'; recipeId: string }
  | { t: 'profile'; first?: boolean } | { t: 'backup' } | { t: 'about' }
  | { t: 'quick'; meal: Meal; entryId?: string } | { t: 'dayMeal' } | { t: 'meals' } | { t: 'goal' }
  | { t: 'offs'; meal?: Meal };
/** The Open Food Facts search: what was asked, the results so far and the filter sheet. */
export interface OffSearch { q: string; f: Filters; draftF: Filters; sheet: boolean; page: number; hits: OffProduct[]; count: number; pages: number; status: 'idle' | 'loading' | 'ok' | 'offline' | 'error' | 'limit'; wait: number; detail?: string }
export interface Settings { theme: 'system' | 'light' | 'dark'; meals?: MealDef[]; waterGoal?: number; adviceUntil?: string }
export interface Store {
  db: IDBDatabase; root: HTMLElement;
  profile: Profile | null; overrides: Overrides; settings: Settings;
  products: Product[]; entries: Entry[]; recipes: Recipe[]; weights: Weight[]; pending: Pending[]; days: DayMeals[]; water: Water[]; goal: WeightGoal | null;
  ui: { tab: Tab; date: string; stack: Page[]; toast: { msg: string; undo?: () => void } | null; q: string; list: 'recent' | 'fav' | 'recipes' | 'all';
    draft: Record<string, string>; recipeDraft: Recipe | null; err: string; prog: 'cal' | 'weight' | 'water'; month: string; sel: string; range: 30 | 90 | 0; off: OffSearch };
}
export let store: Store = null as unknown as Store;
export const initStore = (s: Omit<Store, 'ui'>): Store => { store = { ...s, ui: { tab: 'today', date: localDate(), stack: [], toast: null, q: '', list: 'recent', draft: {}, recipeDraft: null, err: '', prog: 'cal', month: localDate().slice(0, 7), sel: localDate(), range: 90, off: { q: '', f: loadFilters(), draftF: loadFilters(), sheet: false, page: 0, hits: [], count: 0, pages: 0, status: 'idle', wait: 0 } } }; return store; };
/* Search filters and recent searches are conveniences: kept in localStorage under fuelsmith.*, not in the backup. */
export function loadFilters(): Filters { try { const j = JSON.parse(localStorage.getItem('fuelsmith.searchFilters') ?? 'null'); if (j && typeof j === 'object') return { ...DEFAULT_FILTERS, ...j, cats: Array.isArray(j.cats) ? j.cats : [], labels: Array.isArray(j.labels) ? j.labels : [] }; } catch { /* none */ } return { ...DEFAULT_FILTERS }; }
export function saveFilters(f: Filters): void { try { localStorage.setItem('fuelsmith.searchFilters', JSON.stringify(f)); } catch { /* private mode */ } }
export function recentSearches(): string[] { try { const j = JSON.parse(localStorage.getItem('fuelsmith.recentSearches') ?? '[]'); return Array.isArray(j) ? j.filter((x): x is string => typeof x === 'string').slice(0, 5) : []; } catch { return []; } }
export function rememberSearch(q: string): void { const t = q.trim(); if (!t) return; const xs = [t, ...recentSearches().filter(x => x.toLowerCase() !== t.toLowerCase())].slice(0, 5); try { localStorage.setItem('fuelsmith.recentSearches', JSON.stringify(xs)); } catch { /* private mode */ } }

export function localDate(d = new Date()): string { const z = (n: number) => String(n).padStart(2, '0'); return `${d.getFullYear()}-${z(d.getMonth() + 1)}-${z(d.getDate())}`; }
export const uid = (): string => { try { return crypto.randomUUID(); } catch { return Date.now().toString(36) + Math.random().toString(36).slice(2, 10); } };
export const page = (): Page | null => store.ui.stack[store.ui.stack.length - 1] ?? null;
export const liveProducts = (): Product[] => store.products.filter(p => !p.deletedAt);
export const liveRecipes = (): Recipe[] => store.recipes.filter(r => !r.deletedAt);
export const productById = (id: string): Product | undefined => store.products.find(p => p.id === id);
export const recipeById = (id: string): Recipe | undefined => store.recipes.find(r => r.id === id);
/** Something that can be eaten: a product or a recipe, with its values per 100 g. */
export interface Food { kind: 'product' | 'recipe'; id: string; name: string; sub: string; per100: Per100; serving?: number; pack?: number; lastGrams?: number; fav?: boolean }
export function food(kind: 'product' | 'recipe', id: string): Food | null {
  if (kind === 'product') { const p = productById(id); return p ? { kind, id, name: p.name, sub: [p.brand, p.ean].filter(Boolean).join(' · '), per100: p.per100, serving: p.serving, pack: p.pack, lastGrams: p.lastGrams, fav: p.fav } : null; }
  const r = recipeById(id); if (!r) return null;
  const w = r.cooked && r.cooked > 0 ? r.cooked : r.items.reduce((a, i) => a + i.grams, 0);
  return { kind, id, name: r.name, sub: `przepis · ${r.items.length} skł.`, per100: recipePer100(r), serving: r.servings && w ? Math.round(w / r.servings) : undefined, pack: w || undefined, lastGrams: undefined };
}
export const year = (): number => new Date().getFullYear();
export const DEFAULT_TARGETS: Targets = { kcal: 2000, p: 120, f: 65, c: 230 };
/** The person's targets. With a weight goal, energy follows its pace (unless set by hand); without a profile, defaults. */
export function myTargets(): Targets {
  if (!store.profile) return { ...DEFAULT_TARGETS, ...store.overrides } as Targets;
  const o: Overrides = { ...store.overrides };
  if (store.goal && o.kcal == null) { const kg = currentKg() ?? store.profile.weightKg; o.kcal = Math.round((tdee(store.profile, year()) + paceKcal(kg, store.goal)) / 10) * 10; }
  return targets(store.profile, year(), o);
}
/** The 7-day average weight today, else the last weigh-in, else the profile weight. */
export function currentKg(): number | null { const ws = store.weights; if (!ws.length) return store.profile?.weightKg ?? null; return avg7(ws, localDate()) ?? [...ws].sort((a, b) => a.date.localeCompare(b.date)).pop()!.kg; }
export const waterGoal = (): number => store.settings.waterGoal ?? waterTarget(currentKg() ?? 75);
export const mealPlan = (): MealDef[] => store.settings.meals?.length ? store.settings.meals : DEFAULT_MEALS;
const DEFAULT_NAME = new Map(DEFAULT_MEALS.map(m => [m.id, m.name]));
/** The meals of a day: its frozen list if it has one, else today's plan; meals that only exist in entries are kept at the end. */
export function dayMeals(date: string): MealDef[] {
  const base = store.days.find(d => d.date === date)?.meals ?? mealPlan();
  const extra = [...new Set(store.entries.filter(e => e.date === date).map(e => e.meal))].filter(id => !base.some(m => m.id === id)).map(id => ({ id, name: DEFAULT_NAME.get(id) ?? 'Posiłek' }));
  return [...base, ...extra];
}
export const mealName = (date: string, id: string): string => dayMeals(date).find(m => m.id === id)?.name ?? DEFAULT_NAME.get(id) ?? 'Posiłek';
/** The meal that fits the time of day, used by the scan button on Today. */
export function mealNow(d = new Date(), date = localDate()): Meal { const ms = dayMeals(date); const h = d.getHours() + d.getMinutes() / 60; const k = Math.min(ms.length - 1, Math.max(0, Math.floor(((h - 6) / 16) * ms.length))); return ms[k]!.id; }
export { MEALS };

/* What was picked after typing a text: "skyr" -> the products chosen for it, newest first. Only on the phone (fuelsmith.picks). */
type Picks = Record<string, string[]>;
const readPicks = (): Picks => { try { const j = JSON.parse(localStorage.getItem('fuelsmith.picks') ?? '{}'); return j && typeof j === 'object' && !Array.isArray(j) ? j : {}; } catch { return {}; } };
export function rememberPick(q: string, ref: string): void {
  const k = fold(q.trim()); if (k.length < 2) return; const all = readPicks();
  all[k] = [ref, ...(all[k] ?? []).filter(x => x !== ref)].slice(0, 5);
  const keys = Object.keys(all); if (keys.length > 60) delete all[keys[0]!];   // oldest text first out
  try { localStorage.setItem('fuelsmith.picks', JSON.stringify(all)); } catch { /* private mode */ }
}
/** Products and recipes picked for this text or a longer one that starts with it ("sky" finds what was picked for "skyr"). Deleted ones are skipped. */
export function picksFor(q: string): { kind: 'product' | 'recipe'; id: string }[] {
  const k = fold(q.trim()); if (k.length < 2) return []; const all = readPicks(); const out: string[] = [];
  const exact = all[k] ?? []; const rest = Object.entries(all).filter(([t]) => t !== k && (t.startsWith(k) || k.startsWith(t))).flatMap(([, v]) => v);
  for (const r of [...exact, ...rest]) if (!out.includes(r)) out.push(r);
  return out.map(r => { const [kind, id] = r.split(':') as ['product' | 'recipe', string]; return { kind, id }; })
    .filter(x => x.kind === 'product' ? !!productById(x.id) && !productById(x.id)!.deletedAt : !!recipeById(x.id) && !recipeById(x.id)!.deletedAt).slice(0, 5);
}
