/* Open Food Facts: one product by its barcode. Only the barcode leaves the phone. Data: Open Database License (ODbL), credited in the app.
   The fetch is injected so the tests never touch the network. */
import type { Per100 } from './nutrition';
import { r1 } from './nutrition';

export const OFF_URL = 'https://world.openfoodfacts.org/api/v2/product/';
export const OFF_FIELDS = 'code,product_name,product_name_pl,generic_name_pl,brands,quantity,product_quantity,serving_quantity,serving_size,nutriments';
/** Open Food Facts asks every app to name itself in the User-Agent. */
export const USER_AGENT = 'Fuelsmith/0.5.1 (Android, offline food diary)';

export interface OffProduct { ean: string; name: string; brand?: string; per100: Per100 | null; serving?: number; pack?: number; missing: string[] }
export type Lookup =
  | { kind: 'found'; product: OffProduct }
  | { kind: 'notFound' }
  | { kind: 'offline' }          // no network or the server did not answer: keep the code for later
  | { kind: 'error'; detail: string };

const num = (v: unknown): number | null => { const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : typeof v === 'number' ? v : NaN; return Number.isFinite(n) ? n : null; };
/** "30 g", "1 portion (30 g)", "250 ml" -> grams (ml counted as grams, close enough for drinks). */
export function gramsOf(s: unknown): number | undefined {
  if (typeof s === 'number') return s > 0 ? s : undefined;
  if (typeof s !== 'string') return undefined;
  const m = s.replace(',', '.').match(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/i); if (!m) return undefined;
  const v = parseFloat(m[1]!); const u = m[2]!.toLowerCase();
  const g = u === 'kg' || u === 'l' ? v * 1000 : v; return g > 0 ? Math.round(g) : undefined;
}

/** Maps the API answer to a product. Energy in kJ only is converted (1 kcal = 4.184 kJ). What is missing is listed, never guessed. */
export function mapOff(ean: string, json: unknown): OffProduct | null {
  const j = json as { status?: number; product?: Record<string, unknown> };
  if (!j || !j.product || j.status === 0) return null;
  const p = j.product; const n = (p.nutriments ?? {}) as Record<string, unknown>;
  const kcal = num(n['energy-kcal_100g']) ?? (num(n['energy-kj_100g']) != null ? num(n['energy-kj_100g'])! / 4.184 : num(n['energy_100g']) != null ? num(n['energy_100g'])! / 4.184 : null);
  const pr = num(n['proteins_100g']), fa = num(n['fat_100g']), ca = num(n['carbohydrates_100g']), fi = num(n['fiber_100g']);
  const missing: string[] = [];
  if (kcal == null) missing.push('kcal'); if (pr == null) missing.push('p'); if (fa == null) missing.push('f'); if (ca == null) missing.push('c');
  const per100: Per100 | null = missing.length === 4 ? null : { kcal: Math.round(kcal ?? 0), p: r1(pr ?? 0), f: r1(fa ?? 0), c: r1(ca ?? 0), ...(fi != null ? { fiber: r1(fi) } : {}) };
  const name = String(p.product_name_pl || p.product_name || p.generic_name_pl || '').trim();
  if (!name) missing.push('name');
  const brand = String(p.brands || '').split(',')[0]!.trim() || undefined;
  const serving = num(p.serving_quantity) ?? gramsOf(p.serving_size) ?? undefined;
  const pack = num(p.product_quantity) ?? gramsOf(p.quantity) ?? undefined;
  return { ean, name, ...(brand ? { brand } : {}), per100, ...(serving ? { serving: Math.round(serving) } : {}), ...(pack ? { pack: Math.round(pack) } : {}), missing };
}

export type Fetcher = (url: string, init: RequestInit) => Promise<{ ok: boolean; status: number; json: () => Promise<unknown> }>;
export async function lookupEan(ean: string, fetcher: Fetcher, timeoutMs = 8000): Promise<Lookup> {
  const ctl = typeof AbortController !== 'undefined' ? new AbortController() : null;
  const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : null;
  try {
    const res = await fetcher(`${OFF_URL}${encodeURIComponent(ean)}.json?fields=${OFF_FIELDS}`, { headers: { 'User-Agent': USER_AGENT, Accept: 'application/json' }, ...(ctl ? { signal: ctl.signal } : {}) });
    if (res.status === 404) return { kind: 'notFound' };
    if (!res.ok) return res.status >= 500 || res.status === 429 ? { kind: 'offline' } : { kind: 'error', detail: `HTTP ${res.status}` };
    const p = mapOff(ean, await res.json());
    return p ? { kind: 'found', product: p } : { kind: 'notFound' };
  } catch (e) {
    return { kind: 'offline' };   // no connection, DNS, timeout: the code waits on the list for later
  } finally { if (timer) clearTimeout(timer); }
}
