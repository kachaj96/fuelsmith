import type { Entry, Meal, Overrides, Product, Profile, Recipe, Weight, Per100, Targets } from '../domain/nutrition';
import { recipePer100, targets, MEALS } from '../domain/nutrition';
import type { Pending } from '../storage/backup';

export type Tab = 'today' | 'products' | 'progress' | 'more';
export type Page =
  | { t: 'add'; meal: Meal }
  | { t: 'item'; kind: 'product' | 'recipe'; id: string; meal: Meal; grams?: number; entryId?: string }
  | { t: 'form'; id?: string; ean?: string; meal?: Meal; reason?: 'notFound' | 'incomplete' | 'manual' }
  | { t: 'code'; meal: Meal }
  | { t: 'recipe'; id?: string }
  | { t: 'pickIng'; recipeId: string }
  | { t: 'profile'; first?: boolean } | { t: 'backup' } | { t: 'about' };
export interface Settings { theme: 'system' | 'light' | 'dark' }
export interface Store {
  db: IDBDatabase; root: HTMLElement;
  profile: Profile | null; overrides: Overrides; settings: Settings;
  products: Product[]; entries: Entry[]; recipes: Recipe[]; weights: Weight[]; pending: Pending[];
  ui: { tab: Tab; date: string; stack: Page[]; toast: { msg: string; undo?: () => void } | null; q: string; list: 'recent' | 'fav' | 'recipes' | 'all';
    draft: Record<string, string>; recipeDraft: Recipe | null; err: string };
}
export let store: Store = null as unknown as Store;
export const initStore = (s: Omit<Store, 'ui'>): Store => { store = { ...s, ui: { tab: 'today', date: localDate(), stack: [], toast: null, q: '', list: 'recent', draft: {}, recipeDraft: null, err: '' } }; return store; };

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
export const myTargets = (): Targets => (store.profile ? targets(store.profile, year(), store.overrides) : { ...DEFAULT_TARGETS, ...store.overrides } as Targets);
export const MEAL_NAME: Record<Meal, string> = { breakfast: 'Śniadanie', lunch: 'Obiad', dinner: 'Kolacja', snack: 'Przekąski' };
export const MEAL_TO: Record<Meal, string> = { breakfast: 'śniadania', lunch: 'obiadu', dinner: 'kolacji', snack: 'przekąsek' };
/** The meal that fits the time of day, used by the scan button on Today. */
export function mealNow(d = new Date()): Meal { const h = d.getHours() + d.getMinutes() / 60; return h < 11 ? 'breakfast' : h < 16 ? 'lunch' : h < 21 ? 'dinner' : 'snack'; }
export { MEALS };
