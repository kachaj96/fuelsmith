/* Every data-a handler. The DOM gives the arguments (data-id, data-meal...), the store is the only state, storage is written right away. */
import { cleanEan, MEALS, validEan, recipePer100, type Entry, type Meal, type Product, type Recipe } from '../domain/nutrition';
import { lookupEan, type Fetcher, type OffProduct } from '../domain/off';
import { DEFAULT_FILTERS, RateLimit, sameQuery, searchOff, type Filters, type Sort } from '../domain/search';
import { saveTextFile } from '../platform/files';
import { scanBarcode } from '../platform/scan';
import { exportBackup, restoreBackup, validateBackup } from '../storage/backup';
import { del, getAll, put, putMeta, mirrorTheme } from '../storage/db';
import { draftProfile, formDraft, numOf, profileDraft } from './views';
import { render, renderPage, toast, applyTheme } from './render';
import { rememberSearch, saveFilters } from './state';
import { dayMeals, food, localDate, mealName, mealNow, mealPlan, myTargets, page, productById, recipeById, store, uid, type Page } from './state';
import type { DayMeals, MealDef, Water } from '../domain/nutrition';
import { DEFAULT_MEALS, MAX_MEALS, MEAL_PRESETS } from '../domain/nutrition';
import type { Pace } from '../domain/progress';
import { addDays } from '../domain/nutrition';

const ui = () => store.ui;
const defMeal = (): Meal => mealNow(new Date(), ui().date);
const saveSettings = (): Promise<boolean> => safe(putMeta(store.db, 'settings', store.settings));
/** A day keeps its own copy of the meal list from its first entry or change, so a later change of the plan does not touch it. */
async function ensureDay(date: string): Promise<DayMeals> {
  let d = store.days.find(x => x.date === date); if (d) return d;
  d = { date, meals: dayMeals(date).map(m => ({ ...m })) }; await safe(put(store.db, 'days', d)); store.days = [...store.days, d]; return d;
}
async function saveDay(d: DayMeals): Promise<void> { if (await safe(put(store.db, 'days', d))) store.days = [...store.days.filter(x => x.date !== d.date), d]; }
const safe = async (p: Promise<unknown>): Promise<boolean> => { try { await p; return true; } catch { toast('Nie udało się zapisać. Zrób kopię zapasową w Więcej i uruchom aplikację ponownie.'); return false; } };
export function push(p: Page): void { ui().stack.push(p); ui().draft = {}; ui().err = ''; if (p.t !== 'pickIng') ui().q = ''; render(); }
export function goBack(): boolean {
  if (!ui().stack.length) return false;
  if (page()?.t === 'offs' && ui().off.sheet) { ui().off.sheet = false; renderPage(); return true; }
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
  if (r.kind === 'found') { await openOff(r.product, meal, go); await dropPending(ean); return; }
  if (r.kind === 'notFound') { await dropPending(ean); go({ t: 'form', ean, meal, reason: 'notFound' }); return; }
  // offline or the server is busy: keep the code for later
  if (!store.pending.some(x => x.ean === ean)) { const row = { ean, at: Date.now() }; if (await safe(put(store.db, 'pending', row))) store.pending = [...store.pending, row]; }
  if (replace) ui().stack.pop();
  render(); toast(r.kind === 'offline' ? `Brak internetu. Kod ${ean} czeka w Produktach, sprawdzisz go później albo wpiszesz z etykiety.` : `Open Food Facts nie odpowiada (${r.detail}). Kod czeka w Produktach.`);
}

/** A product from Open Food Facts (scan or search): complete ones are saved and opened to weigh, ones with gaps open the form filled with what there is.
    A product already on the phone (same barcode) is opened instead of a copy, so your corrections win. */
async function openOff(x: OffProduct, meal: Meal, go: (p: Page) => void = push): Promise<void> {
  const ean = validEan(x.ean) ? x.ean : '';
  const local = ean ? store.products.find(p => p.ean === ean && !p.deletedAt) : undefined;
  if (local) { go({ t: 'item', kind: 'product', id: local.id, meal }); return; }
  if (x.per100 && x.name && !x.missing.length) {
    const p: Product = { id: uid(), name: x.name, ...(x.brand ? { brand: x.brand } : {}), ...(ean ? { ean } : {}), per100: x.per100, ...(x.serving ? { serving: x.serving } : {}), ...(x.pack ? { pack: x.pack } : {}), source: 'off', createdAt: Date.now(), updatedAt: Date.now() };
    await saveProduct(p); go({ t: 'item', kind: 'product', id: p.id, meal }); return;
  }
  const s = (v?: number) => (v == null ? '' : String(v).replace('.', ',')); const miss = new Set(x.missing);
  go({ t: 'form', ...(ean ? { ean } : {}), meal, reason: 'incomplete' });
  ui().draft = { name: x.name, brand: x.brand ?? '', ean, kcal: miss.has('kcal') ? '' : s(x.per100?.kcal), p: miss.has('p') ? '' : s(x.per100?.p), f: miss.has('f') ? '' : s(x.per100?.f), c: miss.has('c') ? '' : s(x.per100?.c), fiber: s(x.per100?.fiber), serving: s(x.serving), pack: s(x.pack), __init: '1', __src: 'off' };
  renderPage();
}

/* ---- 0.5: search in Open Food Facts by name ---- */
const limiter = new RateLimit();
const off = () => ui().off;
/** Runs one search. page 1 replaces the results, later pages are added. Nothing is sent when the minute's limit is used up. */
async function runSearch(pg: number): Promise<void> {
  const o = off(); const q = o.q.trim(); if (q.length < 2) return;
  const w = limiter.wait(Date.now()); if (w) { o.status = 'limit'; o.wait = w; renderPage(); return; }
  limiter.take(Date.now()); o.status = 'loading'; if (pg === 1) { o.hits = []; o.count = 0; o.pages = 0; } renderPage();
  const asked = JSON.stringify([q, o.f]);
  const r = await searchOff(q, o.f, pg, fetcher);
  if (JSON.stringify([off().q.trim(), off().f]) !== asked) return;   // a newer search took over
  if (r.kind === 'ok') { o.hits = pg === 1 ? r.hits : [...o.hits, ...r.hits]; o.count = r.count; o.pages = r.pages; o.page = pg; o.status = 'ok'; rememberSearch(q); }
  else { o.status = r.kind; o.detail = r.kind === 'error' ? r.detail : undefined; }
  if (page()?.t === 'offs') renderPage();
}
export function startSearch(q: string, meal?: Meal): void {
  const o = off(); o.q = q.trim(); o.sheet = false; o.status = 'idle';
  if (page()?.t === 'offs') renderPage(); else push({ t: 'offs', ...(meal ? { meal } : {}) });
  void runSearch(1);
}
const setF = (f: Filters): void => { off().f = f; saveFilters(f); };

const A: Record<string, (el: HTMLElement) => void | Promise<void>> = {
  tab: el => { resetTo(); ui().tab = el.dataset.id as typeof store.ui.tab; if (ui().tab === 'today') ui().date = localDate(); render(false); },
  back: () => { goBack(); },
  open: el => {
    const p = el.dataset.p!; const meal = (el.dataset.meal as Meal) || undefined;
    if (p === 'add') push({ t: 'add', meal: meal ?? defMeal() });
    else if (p === 'form') push({ t: 'form', ...(el.dataset.id ? { id: el.dataset.id } : {}), ...(meal ? { meal } : {}), reason: 'manual' });
    else if (p === 'code') push({ t: 'code', meal: meal ?? defMeal() });
    else if (p === 'quick') push({ t: 'quick', meal: meal ?? defMeal() });
    else if (p === 'dayMeal' || p === 'meals' || p === 'goal') push({ t: p } as Page);
    else if (p === 'recipe') { const r = el.dataset.id ? recipeById(el.dataset.id) : undefined; ui().recipeDraft = r ? JSON.parse(JSON.stringify(r)) : { id: uid(), name: '', items: [], createdAt: 0, updatedAt: 0 }; push({ t: 'recipe', ...(r ? { id: r.id } : {}) }); }
    else if (p === 'pickIng') { const r = ui().recipeDraft; if (r) push({ t: 'pickIng', recipeId: r.id }); }
    else if (p === 'profile' || p === 'backup' || p === 'about') push({ t: p } as Page);
  },
  day: el => { const n = +el.dataset.d!; const d = addDays(ui().date, n); if (d > localDate()) return; ui().date = d; render(); },
  list: el => { ui().list = el.dataset.id as typeof store.ui.list; renderPage(); },
  scan: async el => {
    const meal = (el.dataset.meal as Meal) || defMeal();
    const r = await scanBarcode();
    if (r.kind === 'code') { await handleCode(r.code, meal); return; }
    if (r.kind === 'cancel') return;
    push({ t: 'code', meal });
    if (r.detail === 'installing') toast('Skaner pobiera się przez Usługi Google Play. Na razie wpisz kod, za chwilę skan zadziała.');
    else if (r.detail !== 'web') toast('Skaner jest niedostępny na tym telefonie. Wpisz cyfry spod kodu.');
  },
  lookup: async el => { await handleCode(ui().draft.code ?? '', (el.dataset.meal as Meal) || defMeal(), true); },
  retry: async el => { await handleCode(el.dataset.ean!, defMeal()); },
  dropPending: async el => { const ean = el.dataset.ean!; const row = store.pending.find(x => x.ean === ean); await dropPending(ean); render(); if (row) toast(`Usunięto kod ${ean}`, async () => { await safe(put(store.db, 'pending', row)); store.pending = [...store.pending, row]; render(); }); },
  item: el => push({ t: 'item', kind: el.dataset.kind as 'product' | 'recipe', id: el.dataset.id!, meal: (el.dataset.meal as Meal) || (page()?.t === 'add' ? (page() as { meal: Meal }).meal : defMeal()) }),
  entry: el => { const e = store.entries.find(x => x.id === el.dataset.id); if (!e) return; if (e.quick) { push({ t: 'quick', meal: e.meal, entryId: e.id }); return; } const kind = recipeById(e.productId) ? 'recipe' : 'product'; push({ t: 'item', kind, id: e.productId, meal: e.meal, grams: e.grams, entryId: e.id }); },
  grams: el => { ui().draft.grams = String(el.dataset.v).replace('.', ','); renderPage(); },
  fav: async el => { const p = productById(el.dataset.id!); if (!p) return; p.fav = !p.fav; await saveProduct(p); renderPage(); },
  addEntry: async () => {
    const p = page(); if (!p || p.t !== 'item') return; const f = food(p.kind, p.id); if (!f) return;
    const g = numOf(ui().draft.grams ?? String(p.grams ?? f.lastGrams ?? f.serving ?? 100)); if (!g || g <= 0 || g > 5000) return;
    const meal = ((ui().draft.meal as Meal) || p.meal); const e: Entry = { id: uid(), date: ui().date, meal, productId: f.id, name: f.name, grams: g, per100: f.per100, at: Date.now() };
    await ensureDay(e.date); if (!(await safe(put(store.db, 'entries', e)))) return; store.entries = [...store.entries, e];
    const prod = productById(f.id); if (prod) { prod.lastGrams = g; prod.checked = true; await saveProduct(prod); }
    resetTo(); ui().tab = 'today'; render(false);
    toast(`Dodano do: ${mealName(e.date, meal)}. ${f.name}, ${Math.round((f.per100.kcal * g) / 100)} kcal`, async () => { await safe(del(store.db, 'entries', e.id)); store.entries = store.entries.filter(x => x.id !== e.id); render(); });
  },
  saveEntry: async () => {
    const p = page(); if (!p || p.t !== 'item' || !p.entryId) return; const e = store.entries.find(x => x.id === p.entryId); if (!e) return;
    const g = numOf(ui().draft.grams ?? String(e.grams)); if (!g || g <= 0 || g > 5000) return;
    const n: Entry = { ...e, grams: g, meal: (ui().draft.meal as Meal) || e.meal };
    if (!(await safe(put(store.db, 'entries', n)))) return; store.entries = store.entries.map(x => (x.id === n.id ? n : x)); resetTo(); render(); toast('Zapisano');
  },
  delEntry: async () => {
    const p = page(); if (!p || (p.t !== 'item' && p.t !== 'quick') || !p.entryId) return; const e = store.entries.find(x => x.id === p.entryId); if (!e) return;
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

  /* ---- 0.4: water, meals of a day, repeat, calendar, quick calories, meal plan, weight goal, advice ---- */
  water: async el => { const ml = +el.dataset.v!; const w: Water = { id: uid(), date: ui().date === localDate() || store.ui.tab !== 'progress' ? ui().date : localDate(), ml, at: Date.now() };
    if (!(await safe(put(store.db, 'water', w)))) return; store.water = [...store.water, w]; render(); toast(`Woda +${ml} ml`, async () => { await safe(del(store.db, 'water', w.id)); store.water = store.water.filter(x => x.id !== w.id); render(); }); },
  waterCustom: async () => { const v = numOf(ui().draft.wml); if (!v || v < 10 || v > 3000) { ui().err = 'wml'; render(); return; } ui().draft = {}; ui().err = ''; const b = document.createElement('button'); b.dataset.v = String(Math.round(v)); await A.water!(b); },
  delWater: async el => { const w = store.water.find(x => x.id === el.dataset.id); if (!w) return; await safe(del(store.db, 'water', w.id)); store.water = store.water.filter(x => x.id !== w.id); render(); toast(`Usunięto ${w.ml} ml`, async () => { await safe(put(store.db, 'water', w)); store.water = [...store.water, w]; render(); }); },
  saveWaterGoal: async () => { const v = numOf(ui().draft.wgoal); if (v != null && (Number.isNaN(v) || v < 500 || v > 6000)) { ui().err = 'wml'; render(); return; } store.settings = { ...store.settings, waterGoal: v ? Math.round(v) : undefined }; await saveSettings(); ui().draft = {}; ui().err = ''; render(); toast(v ? `Cel wody: ${Math.round(v)} ml` : 'Cel wody: propozycja z wagi'); },
  dropMeal: async el => { const id = el.dataset.id!; if (store.entries.some(e => e.date === ui().date && e.meal === id)) return; const d = await ensureDay(ui().date); const was = { date: d.date, meals: [...d.meals] }; const name = d.meals.find(m => m.id === id)?.name ?? '';
    await saveDay({ date: d.date, meals: d.meals.filter(m => m.id !== id) }); render(); toast(`Usunięto z tego dnia: ${name}`, async () => { await saveDay(was); render(); }); },
  repeatMeal: async el => { const id = el.dataset.id!; const date = ui().date; const src = store.entries.filter(e => e.date === addDays(date, -1) && e.meal === id); if (!src.length) return; await ensureDay(date);
    const add = src.map(e => ({ ...e, id: uid(), date, at: Date.now() })); for (const e of add) await safe(put(store.db, 'entries', e)); store.entries = [...store.entries, ...add]; render();
    toast(`Powtórzono ${add.length} ${add.length === 1 ? 'pozycję' : 'pozycje'}`, async () => { for (const e of add) await safe(del(store.db, 'entries', e.id)); const ids = new Set(add.map(e => e.id)); store.entries = store.entries.filter(e => !ids.has(e.id)); render(); }); },
  repeatDay: async el => { const from = el.dataset.d!; const to = localDate(); const src = store.entries.filter(e => e.date === from); if (!src.length) return;
    const fromMeals = dayMeals(from); const d = await ensureDay(to); const meals = [...d.meals];
    for (const m of fromMeals) if (src.some(e => e.meal === m.id) && !meals.some(x => x.id === m.id) && meals.length < MAX_MEALS) meals.push(m);
    await saveDay({ date: to, meals }); const add = src.map(e => ({ ...e, id: uid(), date: to, at: Date.now() })); for (const e of add) await safe(put(store.db, 'entries', e)); store.entries = [...store.entries, ...add];
    resetTo(); ui().tab = 'today'; ui().date = to; render(false); toast(`Skopiowano ${add.length} pozycji do dziś`, async () => { const ids = new Set(add.map(e => e.id)); for (const e of add) await safe(del(store.db, 'entries', e.id)); store.entries = store.entries.filter(e => !ids.has(e.id)); render(); }); },
  openDay: el => { resetTo(); ui().tab = 'today'; ui().date = el.dataset.d!; render(false); },
  calSel: el => { ui().sel = el.dataset.d!; render(); },
  month: el => { const [y, m] = ui().month.split('-').map(Number) as [number, number]; const t = new Date(y, m - 1 + +el.dataset.d!, 1); const k = `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}`; if (k > localDate().slice(0, 7)) return; ui().month = k; render(); },
  prog: el => { ui().prog = el.dataset.id as typeof store.ui.prog; ui().err = ''; render(false); },
  range: el => { ui().range = +el.dataset.v! as 30 | 90 | 0; render(); },
  mname: el => { ui().draft.mname = el.dataset.v!; renderPage(); },
  addDayMeal: async () => { const name = (ui().draft.mname ?? '').trim(); if (!name) { ui().err = 'mname'; renderPage(); return; }
    const d = await ensureDay(ui().date); if (d.meals.length >= MAX_MEALS) return; const after = ui().draft.after ?? d.meals[d.meals.length - 1]?.id; const m: MealDef = { id: uid(), name: name.slice(0, 30) };
    const meals = [...d.meals]; const i = after === '__first' ? 0 : meals.findIndex(x => x.id === after) + 1 || meals.length; meals.splice(i, 0, m);
    await saveDay({ date: d.date, meals }); resetTo(); render(); toast(`Dodano posiłek: ${m.name}`); },
  mmove: async el => { const k = +el.dataset.k!, dir = +el.dataset.d!; const ms = [...mealPlan()]; const j = k + dir; if (j < 0 || j >= ms.length) return; [ms[k], ms[j]] = [ms[j]!, ms[k]!]; store.settings = { ...store.settings, meals: ms }; await saveSettings(); renderPage(); },
  mdel: async el => { const k = +el.dataset.k!; const ms = [...mealPlan()]; if (ms.length <= 1) return; const was = mealPlan(); const [gone] = ms.splice(k, 1); store.settings = { ...store.settings, meals: ms }; await saveSettings(); renderPage();
    toast(`Usunięto z układu: ${gone!.name}. Dni z wpisami bez zmian.`, async () => { store.settings = { ...store.settings, meals: was }; await saveSettings(); renderPage(); }); },
  madd: async () => { const ms = [...mealPlan()]; if (ms.length >= MAX_MEALS) return; ms.push({ id: uid(), name: `Posiłek ${ms.length + 1}` }); store.settings = { ...store.settings, meals: ms }; await saveSettings(); renderPage(); },
  mpreset: async el => { const pr = MEAL_PRESETS[+el.dataset.k!]; if (!pr) return; const was = mealPlan();
    const byName = new Map([...DEFAULT_MEALS, ...was].map(m => [m.name, m.id]));   // keep the ids of known names, so the four built-in meals still match old entries
    store.settings = { ...store.settings, meals: pr.meals.map(n => ({ id: byName.get(n) ?? uid(), name: n })) }; await saveSettings(); renderPage();
    toast(`Układ: ${pr.name}`, async () => { store.settings = { ...store.settings, meals: was }; await saveSettings(); renderPage(); }); },
  saveQuick: async () => { const p = page(); if (!p || p.t !== 'quick') return; const d = ui().draft; const k = numOf(d.qkcal); if (!k || k < 1 || k > 5000) { ui().err = 'qkcal'; renderPage(); return; }
    const per = { kcal: Math.round(k), p: numOf(d.qp) || 0, f: numOf(d.qf) || 0, c: numOf(d.qc) || 0 }; const meal = (d.meal as Meal) || p.meal; const old = p.entryId ? store.entries.find(e => e.id === p.entryId) : undefined;
    const e = { ...(old ?? { id: uid(), date: ui().date, at: Date.now(), productId: 'quick' }), meal, name: (d.qname ?? '').trim() || 'Szybkie kalorie', grams: 100, per100: per, quick: true };
    await ensureDay(e.date); if (!(await safe(put(store.db, 'entries', e)))) return; store.entries = [...store.entries.filter(x => x.id !== e.id), e]; resetTo(); ui().tab = 'today'; render(false); toast(old ? 'Zapisano' : `Dodano ${per.kcal} kcal do: ${mealName(e.date, meal)}`); },
  gpace: el => { ui().draft.pace = el.dataset.v!; renderPage(); },
  saveGoal: async () => { const t = numOf(ui().draft.gkg); if (!t || t < 30 || t > 300) { ui().err = 'gkg'; renderPage(); return; }
    const was = store.goal; store.goal = { targetKg: Math.round(t * 10) / 10, pace: (ui().draft.pace as Pace) || 'mod', setAt: localDate() }; await safe(putMeta(store.db, 'goal', store.goal)); resetTo(); render(); toast(`Cel: ${String(store.goal.targetKg).replace('.', ',')} kg, kalorie ${myTargets().kcal}`, async () => { store.goal = was; await safe(putMeta(store.db, 'goal', was)); render(); }); },
  delGoal: async () => { const was = store.goal; store.goal = null; await safe(putMeta(store.db, 'goal', null)); resetTo(); render(); toast('Usunięto cel wagi', async () => { store.goal = was; await safe(putMeta(store.db, 'goal', was)); render(); }); },
  applyAdvice: async el => { const dk = +el.dataset.v!; const was = { ...store.overrides }; const k = myTargets().kcal + dk; store.overrides = { ...store.overrides, kcal: k }; await safe(putMeta(store.db, 'overrides', store.overrides)); render();
    toast(`Cel kalorii: ${k}`, async () => { store.overrides = was; await safe(putMeta(store.db, 'overrides', was)); render(); }); },
  dismissAdvice: async () => { store.settings = { ...store.settings, adviceUntil: addDays(localDate(), 7) }; await saveSettings(); render(); toast('Podpowiedź wróci za tydzień, jeśli nadal będzie aktualna'); },
  offSearch: el => { const q = el.dataset.q ?? ui().q; const meal = (el.dataset.meal as Meal) || (page()?.t === 'add' ? (page() as { meal: Meal }).meal : undefined); if (q.trim().length >= 2) startSearch(q, meal); },
  offGo: () => { void runSearch(1); },
  offMore: () => { void runSearch(off().page + 1); },
  offPick: async el => { const x = off().hits[+el.dataset.i!]; const p = page(); if (!x || p?.t !== 'offs') return; await openOff(x, p.meal ?? defMeal()); },
  offSheet: () => { const o = off(); o.draftF = JSON.parse(JSON.stringify(o.f)); o.sheet = true; renderPage(); },
  offClose: () => { off().sheet = false; renderPage(); },
  offCat: el => { const d = off().draftF; const id = el.dataset.id!; d.cats = d.cats.includes(id) ? d.cats.filter(x => x !== id) : [...d.cats, id]; renderPage(); },
  offLabel: el => { const d = off().draftF; const id = el.dataset.id!; d.labels = d.labels.includes(id) ? d.labels.filter(x => x !== id) : [...d.labels, id]; renderPage(); },
  offToggle: el => { const d = off().draftF; const k = el.dataset.id as 'poland' | 'full'; d[k] = !d[k]; renderPage(); },
  offSort: el => { off().draftF.sort = el.dataset.id as Sort; renderPage(); },
  offClear: () => { off().draftF = { ...DEFAULT_FILTERS, cats: [], labels: [] }; renderPage(); },
  offApply: () => { const o = off(); const same = sameQuery(o.draftF, o.f); setF(JSON.parse(JSON.stringify(o.draftF))); o.sheet = false; if (same) renderPage(); else void runSearch(1); },
  /** A chip under the field removes one filter at once (a new search). */
  offDrop: el => { const o = off(); const [k, id] = el.dataset.id!.split(':') as [string, string]; const f: Filters = JSON.parse(JSON.stringify(o.f));
    if (k === 'cat') f.cats = f.cats.filter(x => x !== id); else if (k === 'label') f.labels = f.labels.filter(x => x !== id); else if (k === 'poland') f.poland = false; else if (k === 'full') f.full = false;
    setF(f); void runSearch(1); },
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
  if (k === 'oq') { ui().off.q = el.value; renderPage(true); return; }
  if (k === 'ing') { const r = ui().recipeDraft; if (r) { const v = numOf(el.value); r.items[+el.dataset.k!]!.grams = v && v > 0 ? v : 0; renderPage(true); } return; }
  if (k === 'rname') { if (ui().recipeDraft) ui().recipeDraft!.name = el.value; return; }
  if (k === 'cooked' || k === 'servings') { const r = ui().recipeDraft; if (r) { const v = numOf(el.value); if (k === 'cooked') r.cooked = v && v > 0 ? v : undefined; else r.servings = v && v > 0 ? Math.round(v) : undefined; renderPage(true); } return; }
  if (k === 'mrename') { const ms = [...mealPlan()]; const i = +el.dataset.k!; if (ms[i]) { ms[i] = { ...ms[i]!, name: el.value.slice(0, 30) }; store.settings = { ...store.settings, meals: ms }; } return; }
  if (p?.t === 'form') formDraft(); if (p?.t === 'profile') profileDraft();
  ui().draft[k] = el.value;
  if (p?.t === 'item' || p?.t === 'form' || p?.t === 'profile' || p?.t === 'goal' || p?.t === 'dayMeal') renderPage(true);
}
/** Enter in a search field: on Products and Add it asks Open Food Facts, on the results page it searches again. */
export function onKey(ev: KeyboardEvent): void {
  if (ev.key !== 'Enter') return; const el = ev.target as HTMLInputElement; const k = el.dataset?.f;
  if (k === 'q' && page()?.t !== 'pickIng' && el.value.trim().length >= 2) { ev.preventDefault(); el.blur(); const p = page(); startSearch(el.value, p?.t === 'add' ? p.meal : undefined); }
  else if (k === 'oq' && el.value.trim().length >= 2) { ev.preventDefault(); el.blur(); ui().off.q = el.value; void runSearch(1); }
}
export function onChange(ev: Event): void {
  const el = ev.target as HTMLInputElement;
  if (el.dataset.f === 'meal') { ui().draft.meal = el.value; renderPage(true); }
  if (el.dataset.f === 'after') ui().draft.after = el.value;
  if (el.dataset.f === 'mrename') { const ms = mealPlan().map(m => ({ ...m, name: m.name.trim() || 'Posiłek' })); store.settings = { ...store.settings, meals: ms }; void saveSettings(); }
  if (el.dataset.f === 'importFile' && el.files?.[0]) void importFile(el.files[0]);
}
export { MEALS };
