/* Every data-a handler. The DOM gives the arguments (data-id, data-meal...), the store is the only state, storage is written right away. */
import { cleanEan, MEALS, validEan, recipePer100, type Entry, type Meal, type Product, type Recipe } from '../domain/nutrition';
import { lookupEan, type Fetcher } from '../domain/off';
import { saveTextFile } from '../platform/files';
import { scanBarcode } from '../platform/scan';
import { exportBackup, restoreBackup, validateBackup } from '../storage/backup';
import { del, getAll, put, putMeta, mirrorTheme } from '../storage/db';
import { draftProfile, formDraft, numOf, profileDraft } from './views';
import { render, renderPage, toast, applyTheme } from './render';
import { food, localDate, page, productById, recipeById, store, uid, type Page } from './state';
import { addDays } from '../domain/nutrition';

const ui = () => store.ui;
const safe = async (p: Promise<unknown>): Promise<boolean> => { try { await p; return true; } catch { toast('Nie udało się zapisać. Zrób kopię zapasową w Więcej i uruchom aplikację ponownie.'); return false; } };
export function push(p: Page): void { ui().stack.push(p); ui().draft = {}; ui().err = ''; if (p.t !== 'pickIng') ui().q = ''; render(); }
export function goBack(): boolean {
  if (!ui().stack.length) return false;
  const was = ui().stack.pop()!; ui().draft = {}; ui().err = '';
  if (was.t === 'recipe') ui().recipeDraft = null;
  render(); return true;
}
const resetTo = (): void => { ui().stack = []; ui().draft = {}; ui().err = ''; ui().q = ''; ui().recipeDraft = null; };
/** The browser fetch on the web; on the phone CapacitorHttp patches fetch so the User-Agent header is really sent. */
export let fetcher: Fetcher = (u, i) => fetch(u, i);
export const setFetcher = (f: Fetcher): void => { fetcher = f; };

async function saveProduct(p: Product): Promise<void> { p.updatedAt = Date.now(); if (await safe(put(store.db, 'products', p))) store.products = [...store.products.filter(x => x.id !== p.id), p]; }
async function dropPending(ean: string): Promise<void> { await safe(del(store.db, 'pending', ean)); store.pending = store.pending.filter(x => x.ean !== ean); }

/** A barcode from the scanner or typed: the phone first, then Open Food Facts, then the form. Without internet the code waits. */
export async function handleCode(raw: string, meal: Meal, replace = false): Promise<void> {
  const ean = cleanEan(raw);
  if (!validEan(ean)) { if (page()?.t === 'code') { ui().err = 'ean'; renderPage(); } else toast(`Kod ${ean || raw} nie wygląda na EAN. Wpisz go ręcznie.`); return; }
  const go = (p: Page) => { if (replace) ui().stack.pop(); push(p); };
  const local = store.products.find(p => p.ean === ean && !p.deletedAt);
  if (local) { go({ t: 'item', kind: 'product', id: local.id, meal }); return; }
  toast('Szukam w Open Food Facts…');
  const r = await lookupEan(ean, fetcher);
  ui().toast = null;
  if (r.kind === 'found' && r.product.per100 && r.product.name && !r.product.missing.length) {
    const p: Product = { id: uid(), name: r.product.name, ...(r.product.brand ? { brand: r.product.brand } : {}), ean, per100: r.product.per100, ...(r.product.serving ? { serving: r.product.serving } : {}), ...(r.product.pack ? { pack: r.product.pack } : {}), source: 'off', createdAt: Date.now(), updatedAt: Date.now() };
    await saveProduct(p); await dropPending(ean);
    go({ t: 'item', kind: 'product', id: p.id, meal }); return;
  }
  if (r.kind === 'found') {   // known, but without a name or with gaps: the form, filled with what there is
    const s = (v?: number) => (v == null ? '' : String(v).replace('.', ','));
    const x = r.product; const miss = new Set(x.missing);
    go({ t: 'form', ean, meal, reason: 'incomplete' });
    ui().draft = { name: x.name, brand: x.brand ?? '', ean, kcal: miss.has('kcal') ? '' : s(x.per100?.kcal), p: miss.has('p') ? '' : s(x.per100?.p), f: miss.has('f') ? '' : s(x.per100?.f), c: miss.has('c') ? '' : s(x.per100?.c), fiber: s(x.per100?.fiber), serving: s(x.serving), pack: s(x.pack), __init: '1', __src: 'off' };
    await dropPending(ean); renderPage(); return;
  }
  if (r.kind === 'notFound') { await dropPending(ean); go({ t: 'form', ean, meal, reason: 'notFound' }); return; }
  // offline or the server is busy: keep the code for later
  if (!store.pending.some(x => x.ean === ean)) { const row = { ean, at: Date.now() }; if (await safe(put(store.db, 'pending', row))) store.pending = [...store.pending, row]; }
  if (replace) ui().stack.pop();
  render(); toast(r.kind === 'offline' ? `Brak internetu. Kod ${ean} czeka w Produktach, sprawdzisz go później albo wpiszesz z etykiety.` : `Open Food Facts nie odpowiada (${r.detail}). Kod czeka w Produktach.`);
}

const A: Record<string, (el: HTMLElement) => void | Promise<void>> = {
  tab: el => { resetTo(); ui().tab = el.dataset.id as typeof store.ui.tab; if (ui().tab === 'today') ui().date = localDate(); render(false); },
  back: () => { goBack(); },
  open: el => {
    const p = el.dataset.p!; const meal = (el.dataset.meal as Meal) || undefined;
    if (p === 'add') push({ t: 'add', meal: meal ?? 'snack' });
    else if (p === 'form') push({ t: 'form', ...(el.dataset.id ? { id: el.dataset.id } : {}), ...(meal ? { meal } : {}), reason: 'manual' });
    else if (p === 'code') push({ t: 'code', meal: meal ?? 'snack' });
    else if (p === 'recipe') { const r = el.dataset.id ? recipeById(el.dataset.id) : undefined; ui().recipeDraft = r ? JSON.parse(JSON.stringify(r)) : { id: uid(), name: '', items: [], createdAt: 0, updatedAt: 0 }; push({ t: 'recipe', ...(r ? { id: r.id } : {}) }); }
    else if (p === 'pickIng') { const r = ui().recipeDraft; if (r) push({ t: 'pickIng', recipeId: r.id }); }
    else if (p === 'profile' || p === 'backup' || p === 'about') push({ t: p } as Page);
  },
  day: el => { const n = +el.dataset.d!; const d = addDays(ui().date, n); if (d > localDate()) return; ui().date = d; render(); },
  list: el => { ui().list = el.dataset.id as typeof store.ui.list; renderPage(); },
  scan: async el => {
    const meal = (el.dataset.meal as Meal) || 'snack';
    const r = await scanBarcode();
    if (r.kind === 'code') { await handleCode(r.code, meal); return; }
    if (r.kind === 'cancel') return;
    push({ t: 'code', meal });
    if (r.detail === 'installing') toast('Skaner pobiera się przez Usługi Google Play. Na razie wpisz kod, za chwilę skan zadziała.');
    else if (r.detail !== 'web') toast('Skaner jest niedostępny na tym telefonie. Wpisz cyfry spod kodu.');
  },
  lookup: async el => { await handleCode(ui().draft.code ?? '', (el.dataset.meal as Meal) || 'snack', true); },
  retry: async el => { await handleCode(el.dataset.ean!, 'snack'); },
  dropPending: async el => { const ean = el.dataset.ean!; const row = store.pending.find(x => x.ean === ean); await dropPending(ean); render(); if (row) toast(`Usunięto kod ${ean}`, async () => { await safe(put(store.db, 'pending', row)); store.pending = [...store.pending, row]; render(); }); },
  item: el => push({ t: 'item', kind: el.dataset.kind as 'product' | 'recipe', id: el.dataset.id!, meal: (el.dataset.meal as Meal) || (page()?.t === 'add' ? (page() as { meal: Meal }).meal : 'snack') }),
  entry: el => { const e = store.entries.find(x => x.id === el.dataset.id); if (!e) return; const kind = recipeById(e.productId) ? 'recipe' : 'product'; push({ t: 'item', kind, id: e.productId, meal: e.meal, grams: e.grams, entryId: e.id }); },
  grams: el => { ui().draft.grams = String(el.dataset.v).replace('.', ','); renderPage(); },
  fav: async el => { const p = productById(el.dataset.id!); if (!p) return; p.fav = !p.fav; await saveProduct(p); renderPage(); },
  addEntry: async () => {
    const p = page(); if (!p || p.t !== 'item') return; const f = food(p.kind, p.id); if (!f) return;
    const g = numOf(ui().draft.grams ?? String(p.grams ?? f.lastGrams ?? f.serving ?? 100)); if (!g || g <= 0 || g > 5000) return;
    const meal = ((ui().draft.meal as Meal) || p.meal); const e: Entry = { id: uid(), date: ui().date, meal, productId: f.id, name: f.name, grams: g, per100: f.per100, at: Date.now() };
    if (!(await safe(put(store.db, 'entries', e)))) return; store.entries = [...store.entries, e];
    const prod = productById(f.id); if (prod) { prod.lastGrams = g; prod.checked = true; await saveProduct(prod); }
    resetTo(); ui().tab = 'today'; render(false);
    toast(`Dodano: ${f.name}, ${Math.round((f.per100.kcal * g) / 100)} kcal`, async () => { await safe(del(store.db, 'entries', e.id)); store.entries = store.entries.filter(x => x.id !== e.id); render(); });
  },
  saveEntry: async () => {
    const p = page(); if (!p || p.t !== 'item' || !p.entryId) return; const e = store.entries.find(x => x.id === p.entryId); if (!e) return;
    const g = numOf(ui().draft.grams ?? String(e.grams)); if (!g || g <= 0 || g > 5000) return;
    const n: Entry = { ...e, grams: g, meal: (ui().draft.meal as Meal) || e.meal };
    if (!(await safe(put(store.db, 'entries', n)))) return; store.entries = store.entries.map(x => (x.id === n.id ? n : x)); resetTo(); render(); toast('Zapisano');
  },
  delEntry: async () => {
    const p = page(); if (!p || p.t !== 'item' || !p.entryId) return; const e = store.entries.find(x => x.id === p.entryId); if (!e) return;
    await safe(del(store.db, 'entries', e.id)); store.entries = store.entries.filter(x => x.id !== e.id); resetTo(); render();
    toast(`Usunięto: ${e.name}`, async () => { await safe(put(store.db, 'entries', e)); store.entries = [...store.entries, e]; render(); });
  },
  saveProduct: async () => {
    const p = page(); if (!p || p.t !== 'form') return; const d = formDraft();
    if (!d.name?.trim()) { ui().err = 'name'; renderPage(); return; }
    const vals = ['kcal', 'p', 'f', 'c'].map(k => numOf(d[k])); if (vals.some(v => v == null || Number.isNaN(v) || v < 0)) { ui().err = 'num'; renderPage(); return; }
    const ean = cleanEan(d.ean ?? ''); if (ean && !validEan(ean)) { ui().err = 'ean'; renderPage(); return; }
    const old = p.id ? productById(p.id) : undefined; const fib = numOf(d.fiber); const sv = numOf(d.serving); const pk = numOf(d.pack);
    const prod: Product = { ...(old ?? { id: uid(), createdAt: Date.now(), source: d.__src === 'off' ? 'off' : 'user' }), name: d.name.trim(), brand: d.brand?.trim() || undefined, ean: ean || undefined,
      per100: { kcal: Math.round(vals[0]!), p: vals[1]!, f: vals[2]!, c: vals[3]!, ...(fib && fib > 0 ? { fiber: fib } : {}) }, serving: sv && sv > 0 ? sv : undefined, pack: pk && pk > 0 ? pk : undefined,
      checked: true, ...(old?.source === 'off' ? { edited: true } : {}), updatedAt: Date.now() } as Product;
    await saveProduct(prod); if (ean) await dropPending(ean);
    ui().stack.pop();
    if (p.meal && !p.id) { push({ t: 'item', kind: 'product', id: prod.id, meal: p.meal }); return; }
    ui().draft = {}; ui().err = ''; render(); toast('Zapisano produkt');
  },
  delProduct: async () => {
    const p = page(); if (!p || p.t !== 'form' || !p.id) return; const prod = productById(p.id); if (!prod) return;
    const was = { ...prod }; prod.deletedAt = Date.now(); await saveProduct(prod); resetTo(); render();
    toast(`Usunięto produkt: ${prod.name}. Wpisy w dzienniku zostają.`, async () => { await saveProduct(was); render(); });
  },
  dropIng: el => { const r = ui().recipeDraft; if (!r) return; r.items.splice(+el.dataset.k!, 1); renderPage(); },
  pickIng: el => { const r = ui().recipeDraft; const p = productById(el.dataset.id!); if (!r || !p) return; r.items.push({ productId: p.id, name: p.name, grams: p.lastGrams ?? p.serving ?? 100, per100: p.per100 }); ui().stack.pop(); ui().q = ''; render(); },
  saveRecipe: async () => {
    const r = ui().recipeDraft; if (!r) return;
    if (!r.name.trim() || !r.items.length || r.items.some(i => !(i.grams > 0))) { ui().err = 'items'; renderPage(); return; }
    const out: Recipe = { ...r, name: r.name.trim(), createdAt: r.createdAt || Date.now(), updatedAt: Date.now() };
    if (!(await safe(put(store.db, 'recipes', out)))) return; store.recipes = [...store.recipes.filter(x => x.id !== out.id), out];
    resetTo(); ui().tab = 'products'; render(); toast(`Zapisano przepis: ${Math.round(recipePer100(out).kcal)} kcal na 100 g`);
  },
  delRecipe: async () => {
    const r = ui().recipeDraft; const cur = r && recipeById(r.id); if (!cur) return;
    const was = { ...cur }; const n = { ...cur, deletedAt: Date.now() }; await safe(put(store.db, 'recipes', n)); store.recipes = store.recipes.map(x => (x.id === n.id ? n : x)); resetTo(); render();
    toast(`Usunięto przepis: ${cur.name}`, async () => { await safe(put(store.db, 'recipes', was)); store.recipes = store.recipes.map(x => (x.id === was.id ? was : x)); render(); });
  },
  saveWeight: async () => {
    const kg = numOf(ui().draft.kg); if (!kg || kg < 30 || kg > 300) { ui().err = 'kg'; render(); return; }
    const w = { date: localDate(), kg: Math.round(kg * 10) / 10 }; if (!(await safe(put(store.db, 'weights', w)))) return;
    store.weights = [...store.weights.filter(x => x.date !== w.date), w]; ui().draft = {}; ui().err = '';
    if (store.profile && Math.abs(store.profile.weightKg - w.kg) >= 0.1) { /* the targets follow the latest weight */ store.profile = { ...store.profile, weightKg: w.kg }; await safe(putMeta(store.db, 'profile', store.profile)); }
    render(); toast(`Zapisano ${String(w.kg).replace('.', ',')} kg`);
  },
  delWeight: async el => { const d = el.dataset.d!; const w = store.weights.find(x => x.date === d); await safe(del(store.db, 'weights', d)); store.weights = store.weights.filter(x => x.date !== d); render(); if (w) toast('Usunięto pomiar', async () => { await safe(put(store.db, 'weights', w)); store.weights = [...store.weights, w]; render(); }); },
  pf: el => { profileDraft(); ui().draft[el.dataset.k!] = el.dataset.v!; renderPage(); },
  saveProfile: async () => {
    const d = profileDraft(); const p = draftProfile(d); if (!p) { ui().err = 'profile'; renderPage(); return; }
    const o = Object.fromEntries((['okcal', 'op', 'of', 'oc'] as const).map(k => [k.slice(1), numOf(d[k])]).filter(([, v]) => v && (v as number) > 0));
    store.profile = p; store.overrides = o; await safe(putMeta(store.db, 'profile', p)); await safe(putMeta(store.db, 'overrides', o));
    resetTo(); render(); toast('Zapisano cele');
  },
  theme: async el => { store.settings = { ...store.settings, theme: el.dataset.id as 'system' | 'light' | 'dark' }; mirrorTheme(store.settings.theme); applyTheme(); await safe(putMeta(store.db, 'settings', store.settings)); render(); },
  export: async () => {
    const data = await exportBackup(store.db); const ok = await saveTextFile(`fuelsmith-${localDate()}.json`, JSON.stringify(data, null, 1));
    toast(ok ? `Kopia gotowa: ${data.entries.length} wpisów, ${data.products.length} produktów` : 'Nie udało się przygotować pliku.');
  },
  undo: () => { const u = ui().toast?.undo; ui().toast = null; renderPage(); if (u) void u(); },
};

export async function importFile(file: File): Promise<void> {
  const text = await file.text(); const c = validateBackup(text);
  if (!c.ok) { ui().err = { json: 'To nie jest plik JSON.', app: 'To nie jest kopia Fuelsmith (inna aplikacja albo inny plik).', schema: 'Kopia z nowszej wersji aplikacji. Zaktualizuj Fuelsmith.', shape: 'Plik jest uszkodzony albo niepełny.' }[c.reason]; renderPage(); return; }
  try { await restoreBackup(store.db, c.data); } catch { ui().err = 'Nie udało się wczytać. Dane w aplikacji się nie zmieniły.'; renderPage(); return; }
  const [products, entries, recipes, weights, pending] = await Promise.all([getAll<Product>(store.db, 'products'), getAll<Entry>(store.db, 'entries'), getAll<Recipe>(store.db, 'recipes'), getAll<{ date: string; kg: number }>(store.db, 'weights'), getAll<{ ean: string; at: number }>(store.db, 'pending')]);
  Object.assign(store, { products, entries, recipes, weights, pending, profile: c.data.profile, overrides: c.data.overrides });
  resetTo(); ui().tab = 'today'; render(false); toast(`Wczytano: ${c.counts.entries} wpisów, ${c.counts.products} produktów, ${c.counts.recipes} przepisów, ${c.counts.weights} pomiarów`);
}

export function onClick(ev: Event): void {
  const el = (ev.target as HTMLElement).closest<HTMLElement>('[data-a]'); if (!el || (el as HTMLButtonElement).disabled) return;
  const f = A[el.dataset.a!]; if (f) void f(el);
}
/* Typing never re-renders the whole page (that would close the keyboard): only the parts that depend on the value are redrawn. */
export function onInput(ev: Event): void {
  const el = ev.target as HTMLInputElement; const k = el.dataset.f; if (!k) return;
  const p = page();
  if (k === 'q') { ui().q = el.value; renderPage(true); return; }
  if (k === 'ing') { const r = ui().recipeDraft; if (r) { const v = numOf(el.value); r.items[+el.dataset.k!]!.grams = v && v > 0 ? v : 0; renderPage(true); } return; }
  if (k === 'rname') { if (ui().recipeDraft) ui().recipeDraft!.name = el.value; return; }
  if (k === 'cooked' || k === 'servings') { const r = ui().recipeDraft; if (r) { const v = numOf(el.value); if (k === 'cooked') r.cooked = v && v > 0 ? v : undefined; else r.servings = v && v > 0 ? Math.round(v) : undefined; renderPage(true); } return; }
  if (p?.t === 'form') formDraft(); if (p?.t === 'profile') profileDraft();
  ui().draft[k] = el.value;
  if (p?.t === 'item' || p?.t === 'form' || p?.t === 'profile') renderPage(true);
}
export function onChange(ev: Event): void {
  const el = ev.target as HTMLInputElement;
  if (el.dataset.f === 'meal') { ui().draft.meal = el.value; renderPage(true); }
  if (el.dataset.f === 'importFile' && el.files?.[0]) void importFile(el.files[0]);
}
export { MEALS };
