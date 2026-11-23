/* Product search in Open Food Facts by name (Search-a-licious, search.openfoodfacts.org). Only the typed text and the filters leave the phone.
   Checked by hand on 2026-11-23: plain words work best (no Polish stemming, AND between words breaks the filters), field:"value" parts act as filters. */
import { looksWrong } from './nutrition';
import { mapOff, USER_AGENT, type Fetcher, type OffProduct } from './off';

export const SEARCH_URL = 'https://search.openfoodfacts.org/search';
export const PAGE_SIZE = 20;
const FIELDS = 'code,product_name,product_name_pl,generic_name_pl,brands,quantity,product_quantity,serving_quantity,serving_size,nutriments';

export interface Category { id: string; name: string; tags: string[] }
export const CATEGORIES: Category[] = [
  { id: 'dairy', name: 'Nabiał', tags: ['en:dairies'] },
  { id: 'meat', name: 'Mięso i ryby', tags: ['en:meats', 'en:seafood'] },
  { id: 'bread', name: 'Pieczywo', tags: ['en:breads'] },
  { id: 'grain', name: 'Zboża i makarony', tags: ['en:cereals-and-potatoes'] },
  { id: 'veg', name: 'Owoce i warzywa', tags: ['en:fruits-and-vegetables-based-foods'] },
  { id: 'drink', name: 'Napoje', tags: ['en:beverages'] },
  { id: 'snack', name: 'Słodycze i przekąski', tags: ['en:snacks'] },
  { id: 'meal', name: 'Gotowe dania', tags: ['en:meals'] },
  { id: 'sauce', name: 'Sosy', tags: ['en:sauces'] },
];
/** Diet labels as printed by the producer. A product passes only when the label is there, so missing data never counts as "yes". */
export const LABELS: { id: string; name: string; tag: string }[] = [
  { id: 'vegan', name: 'Wegańskie', tag: 'en:vegan' },
  { id: 'vegetarian', name: 'Wegetariańskie', tag: 'en:vegetarian' },
  { id: 'gluten', name: 'Bez glutenu', tag: 'en:no-gluten' },
];
export type Sort = 'match' | 'protein' | 'kcal';
export const SORTS: { id: Sort; name: string }[] = [{ id: 'match', name: 'Najlepsze dopasowanie' }, { id: 'protein', name: 'Najwięcej białka na 100 kcal' }, { id: 'kcal', name: 'Najmniej kcal' }];
export interface Filters { cats: string[]; labels: string[]; poland: boolean; full: boolean; sort: Sort }
export const DEFAULT_FILTERS: Filters = { cats: [], labels: [], poland: true, full: true, sort: 'match' };
/** Filters that change what the server returns (sorting is done on the phone). */
export const activeCount = (f: Filters): number => f.cats.length + f.labels.length + (f.poland ? 1 : 0) + (f.full ? 1 : 0);
export const sameQuery = (a: Filters, b: Filters): boolean => a.poland === b.poland && a.full === b.full && a.cats.join() === b.cats.join() && a.labels.join() === b.labels.join();

/** Short Polish words that match half of the base ("pierś z kurczaka" would otherwise find everything with "z"). "bez" stays: "bez laktozy" means something. */
const STOP = new Set(['z', 'ze', 'i', 'w', 'we', 'na', 'do', 'o', 'a', 'oraz', 'od', 'dla', 'po']);
/** The words of the query: query-syntax characters removed, stop words dropped (unless nothing else is left). */
export function words(text: string): string[] {
  const all = text.replace(/[+\-&|!(){}[\]^"~*?:\\/]/g, ' ').split(/\s+/).map(w => w.trim()).filter(Boolean);
  const kept = all.filter(w => !STOP.has(w.toLowerCase()));
  return (kept.length ? kept : all).slice(0, 8);
}
/** Polish endings cut off to add the base form next to the typed one ("jogurty" also asks for "jogurt"). The server has no Polish stemming. */
const ENDINGS = ['ami', 'ach', 'ego', 'emu', 'ów', 'om', 'em', 'ej', 'ie', 'y', 'i', 'u', 'a', 'e', 'ę', 'ą'];
export function stem(w: string): string | null {
  if (w.length < 5 || /\d/.test(w)) return null;
  for (const e of ENDINGS) if (w.toLowerCase().endsWith(e) && w.length - e.length >= 4) return w.slice(0, -e.length);
  return null;
}
export function buildQuery(text: string, f: Filters): string {
  const ws = words(text); const extra = ws.map(stem).filter((x): x is string => !!x && !ws.includes(x));
  const parts = [[...ws, ...extra].join(' ')];
  if (f.poland) parts.push('countries_tags:"en:poland"');
  const cats = CATEGORIES.filter(c => f.cats.includes(c.id)).flatMap(c => c.tags);
  if (cats.length === 1) parts.push(`categories_tags:"${cats[0]}"`);
  else if (cats.length > 1) parts.push(`(${cats.map(t => `categories_tags:"${t}"`).join(' OR ')})`);
  for (const l of LABELS.filter(l => f.labels.includes(l.id))) parts.push(`labels_tags:"${l.tag}"`);
  if (f.full) parts.push('nutriments.proteins_100g:* nutriments.fat_100g:* nutriments.carbohydrates_100g:*');
  return parts.filter(Boolean).join(' ');
}
export const searchUrl = (text: string, f: Filters, page: number): string =>
  `${SEARCH_URL}?${new URLSearchParams({ q: buildQuery(text, f), page: String(page), page_size: String(PAGE_SIZE), fields: FIELDS }).toString()}`;

/** Lower case without Polish marks: "Twaróg" and "twarog" are the same word for ranking. */
export const fold = (s: string): string => s.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ł/g, 'l');
/** How many query words the name or brand contains, by their first 5 letters, so "jogurty" still finds "jogurt" among the results. */
export function matchScore(p: Pick<OffProduct, 'name' | 'brand'>, text: string): number {
  const hay = fold(`${p.name} ${p.brand ?? ''}`); return words(text).map(w => fold(w).slice(0, 5)).filter(w => hay.includes(w)).length;
}
export function sortHits(hits: OffProduct[], text: string, sort: Sort): OffProduct[] {
  const xs = hits.map((h, i) => ({ h, i, m: matchScore(h, text) }));
  // values that do not add up (a typo in the base) go to the end when sorting by numbers
  const ppk = (h: OffProduct) => (h.per100 && h.per100.kcal > 0 && !looksWrong(h.per100) ? h.per100.p / h.per100.kcal : -1);
  const kc = (h: OffProduct) => (h.per100 && !looksWrong(h.per100) ? h.per100.kcal : 1e9);
  xs.sort((a, b) => sort === 'protein' ? ppk(b.h) - ppk(a.h) || a.i - b.i
    : sort === 'kcal' ? kc(a.h) - kc(b.h) || a.i - b.i
    : b.m - a.m || a.i - b.i);
  return xs.map(x => x.h);
}

export type SearchResult = { kind: 'ok'; hits: OffProduct[]; count: number; pages: number } | { kind: 'offline' } | { kind: 'error'; detail: string };
/** One page of results. Hits without a name and without any values are dropped: there is nothing to weigh. */
export async function searchOff(text: string, f: Filters, page: number, fetcher: Fetcher, timeoutMs = 10000): Promise<SearchResult> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetcher(searchUrl(text, f, page), { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, ...(ctl ? { signal: ctl.signal } : {}) });
    if (!res.ok) return res.status >= 500 || res.status === 429 ? { kind: 'offline' } : { kind: 'error', detail: `HTTP ${res.status}` };
    const j = (await res.json()) as { hits?: Record<string, unknown>[]; count?: number; page_count?: number };
    const hits = (j.hits ?? []).map(h => mapOff(String(h.code ?? ''), { status: 1, product: h })).filter((p): p is OffProduct => !!p && !!p.name && !!p.per100);
    return { kind: 'ok', hits, count: j.count ?? hits.length, pages: j.page_count ?? 1 };
  } catch { return { kind: 'offline' }; }
  finally { if (timer) clearTimeout(timer); }
}

/** Open Food Facts allows 10 searches a minute. The phone keeps count so the app says so before the server refuses. */
export class RateLimit {
  private at: number[] = [];
  private max: number; private windowMs: number;
  constructor(max = 10, windowMs = 60000) { this.max = max; this.windowMs = windowMs; }
  /** Seconds to wait before the next search; 0 = go. */
  wait(now: number): number { this.at = this.at.filter(t => now - t < this.windowMs); return this.at.length < this.max ? 0 : Math.ceil((this.windowMs - (now - this.at[0]!)) / 1000); }
  take(now: number): boolean { if (this.wait(now)) return false; this.at.push(now); return true; }
}
