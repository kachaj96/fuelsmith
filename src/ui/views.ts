/* Every screen as an HTML string. Values from storage always go through esc(). Actions are data-a attributes (actions.ts). */
import { addDays, avg7, dayTotals, entryMacros, forGrams, looksWrong, kcalFromMacros, MAX_MEALS, MEAL_PRESETS, MEAL_SUGGESTIONS, r1, targets as calcTargets, tdee, type Meal, type Per100 } from '../domain/nutrition';
import { advise, dayKcal, fiberTarget, forecast, paceKcal, PACE_PCT, planWeeks, realNeed, weekBalance, type Pace } from '../domain/progress';
import { PART_PATHS, RADIUS, TILE } from '../brand-art';
import { VERSION } from '../version';
import { CATEGORIES, LABELS, SORTS, activeCount, sortHits, type Filters } from '../domain/search';
import { currentKg, recentSearches, dayMeals, food, liveProducts, liveRecipes, localDate, mealName, mealNow, mealPlan, myTargets, page, productById, recipeById, store, waterGoal, year, type Page } from './state';

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const IC: Record<string, string> = {
  today: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', products: '<path d="M4 5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3z"/><path d="M8 9h6M8 13h6"/>',
  progress: '<path d="M3 20h18M5 16l4-5 4 3 6-8"/>', more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 6l-6 6 6 6"/>', chev: '<path d="M9 6l6 6-6 6"/>', settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 9v6M10 9v6M13 9v6M17 9v6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', heartf: '<path fill="currentColor" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>', refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>', search: '<circle cx="11" cy="11" r="7"/><path d="M16.5 16.5L21 21"/>', copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"/>', up: '<path d="M6 15l6-6 6 6"/>', down: '<path d="M6 9l6 6 6-6"/>',
};
export const ico = (n: string): string => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${IC[n] ?? ''}</svg>`;
const mark = (s = 24): string => `<svg viewBox="0 0 1024 1024" width="${s}" height="${s}" aria-hidden="true"><rect width="1024" height="1024" rx="${RADIUS}" fill="${TILE}"/>${PART_PATHS.map(d => `<path fill="#fff" d="${d}"/>`).join('')}</svg>`;
const n1 = (x: number): string => String(r1(x)).replace('.', ',');
const kg1 = (x: number): string => r1(x).toFixed(1).replace('.', ',');   // weights always with one decimal: 81,0 kg
const kc = (x: number): string => String(Math.round(x)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
const fmtDay = (d: string): string => { const t = localDate(); if (d === t) return 'Dziś'; if (d === addDays(t, -1)) return 'Wczoraj'; return new Intl.DateTimeFormat('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00')); };
const backTop = (title: string, extra = ''): string => `<div class="top back"><button class="ib" data-a="back" aria-label="Wróć">${ico('back')}</button><h1 class="title grow" id="page-title">${esc(title)}</h1>${extra}</div>`;
const field = (id: string, label: string, value: string, unit = '', opts: { mode?: string; ph?: string; invalid?: boolean; type?: string } = {}): string =>
  `<div class="fld"><label for="${id}">${esc(label)}</label><div class="inp"${opts.invalid ? ' aria-invalid="true"' : ''}><input id="${id}" data-f="${id}" type="${opts.type ?? 'text'}" inputmode="${opts.mode ?? 'decimal'}" autocomplete="off" value="${esc(value)}" placeholder="${esc(opts.ph ?? '')}">${unit ? `<small>${esc(unit)}</small>` : ''}</div></div>`;

/* ---------------- tabs ---------------- */
export function navHtml(): string {
  const tabs: [string, string][] = [['today', 'Dziś'], ['products', 'Produkty'], ['progress', 'Postęp'], ['more', 'Więcej']];
  return `<nav class="nav" aria-label="Nawigacja">${tabs.map(([k, l]) => `<button data-a="tab" data-id="${k}" ${store.ui.tab === k ? 'aria-current="page"' : ''}>${ico(k)}${l}</button>`).join('')}</nav>`;
}
const brandTop = (): string => `<div class="top"><span class="brand grow">${mark()}Fuelsmith</span><button class="ib" data-a="open" data-p="profile" aria-label="Profil i cele">${ico('settings')}</button></div>`;
const macRow = (label: string, v: number, goal: number): string => { const pct = goal ? Math.min(100, (v / goal) * 100) : 0; const over = v > goal * 1.05;
  return `<div class="mac"><span>${label}</span><span class="bar ${over ? 'over' : ''}"><i style="width:${pct.toFixed(0)}%"></i></span><span><b>${n1(v)}</b> <span class="mu">z ${goal} g</span>${over ? ' <span class="warn-t b">ponad</span>' : ''}</span></div>`; };

const dropsHtml = (ml: number, goal: number): string => { const n = 10; const on = goal ? Math.min(n, Math.round((ml / goal) * n)) : 0; return `<span class="drops" aria-hidden="true">${Array.from({ length: n }, (_, k) => `<i class="${k < on ? 'on' : ''}"></i>`).join('')}</span>`; };
const litres = (ml: number): string => n1(ml / 1000) + ' l';
export const waterOf = (date: string): number => store.water.filter(w => w.date === date).reduce((a, w) => a + w.ml, 0);
const dateWord = (d: string): string => new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' }).format(new Date(d + 'T12:00:00'));
export function viewToday(): string {
  const d = store.ui.date, tg = myTargets(); const day = store.entries.filter(e => e.date === d);
  const tot = dayTotals(day); const left = tg.kcal - tot.kcal; const isToday = d === localDate(); const ms = dayMeals(d); const yest = addDays(d, -1);
  const wk = weekBalance(store.entries, d, tg.kcal); const wml = waterOf(d), wg = waterGoal();
  const meals = ms.map(m => {
    const es = day.filter(e => e.meal === m.id).sort((a, b) => a.at - b.at); const k = es.reduce((a, e) => a + entryMacros(e).kcal, 0);
    const prev = es.length ? [] : store.entries.filter(e => e.date === yest && e.meal === m.id); const pk = prev.reduce((a, e) => a + entryMacros(e).kcal, 0);
    return `<div class="meal"><div class="meal-h ${es.length ? '' : 'two-ib'}"><span class="b">${esc(m.name)}</span><span class="${es.length ? 'b' : 'mu'}">${es.length ? kc(k) + ' kcal' : '—'}</span>${es.length ? '' : `<button class="ib" data-a="dropMeal" data-id="${esc(m.id)}" aria-label="Usuń posiłek ${esc(m.name)} z tego dnia">${ico('x')}</button>`}<button class="ib" data-a="open" data-p="add" data-meal="${esc(m.id)}" aria-label="Dodaj do: ${esc(m.name)}">${ico('plus')}</button></div>
      ${es.map(e => `<button class="ent" data-a="entry" data-id="${e.id}"><span class="nm">${esc(e.name)} <span class="mu">${e.quick ? '' : n1(e.grams) + ' g'}</span></span><span class="mu">${kc(entryMacros(e).kcal)} kcal</span></button>`).join('')}
      ${prev.length ? `<button class="ent rep" data-a="repeatMeal" data-id="${esc(m.id)}"><span class="nm">${ico('copy')} Powtórz z wczoraj: ${prev.length} ${prev.length === 1 ? 'pozycja' : 'pozycje'}</span><span class="mu">${kc(pk)} kcal</span></button>` : ''}</div>`;
  }).join('');
  return `${brandTop()}<div class="stack">
    <div class="pad"><div class="datebar"><button class="ib" data-a="day" data-d="-1" aria-label="Poprzedni dzień">${ico('back')}</button><span class="mid meta cap1">${esc(fmtDay(d))}${store.goal ? ` · cel ${n1(store.goal.targetKg)} kg` : store.profile ? ` · ${{ cut: 'redukcja', keep: 'utrzymanie', bulk: 'masa' }[store.profile.goal]}` : ''}</span><button class="ib" data-a="day" data-d="1" aria-label="Następny dzień" ${isToday ? 'disabled style="visibility:hidden"' : ''}>${ico('chev')}</button></div>
      <div class="row" style="align-items:baseline;gap:var(--s2)"><span class="hero" id="left">${kc(Math.abs(left))}</span><span class="mu">${left >= 0 ? 'kcal zostało' : 'kcal ponad cel'}</span></div>
      <div class="meta">${kc(tot.kcal)} z ${kc(tg.kcal)} kcal${wk.filled >= 2 ? ` · tydzień: <span id="week">${wk.delta > 0 ? '+' : wk.delta < 0 ? '−' : '±'}${kc(Math.abs(wk.delta))}</span> kcal od celu (${wk.filled} z 7 dni)` : ''}</div>
      <div style="display:flex;flex-direction:column;gap:var(--s1)">${macRow('Białko', tot.p, tg.p)}${macRow('Tłuszcze', tot.f, tg.f)}${macRow('Węglowodany', tot.c, tg.c)}${macRow('Błonnik', tot.fiber ?? 0, fiberTarget(tg.kcal))}</div>
      <button class="btn pri block" data-a="scan" data-meal="${esc(mealNow(new Date(), d))}">${ico('scan')}Skanuj produkt</button>
      ${!store.profile ? `<div class="note"><span class="b">Cele są domyślne (2000 kcal).</span><span>Uzupełnij profil, a aplikacja policzy je z Twojej wagi, wzrostu i aktywności.</span><button class="btn" data-a="open" data-p="profile">Uzupełnij profil</button></div>` : ''}</div>
    <div class="pad"><div class="card wat-card"><div class="wat"><span><span class="b">Woda</span> <span class="mu" id="water">${litres(wml)} z ${litres(wg)}</span>${dropsHtml(wml, wg)}</span><button class="btn" data-a="water" data-v="250">+250 ml</button><button class="btn" data-a="water" data-v="500">+500</button></div></div></div>
    <div class="pad"><div class="card list">${meals}
      ${ms.length < MAX_MEALS ? `<button class="li has-ib" data-a="open" data-p="dayMeal" style="grid-template-columns:minmax(0,1fr) var(--tap)"><span class="mu">Dodaj posiłek ${isToday ? 'na dziś' : 'do tego dnia'}</span><span class="ib">${ico('plus')}</span></button>` : ''}</div></div>
    ${store.pending.length ? `<div class="pad"><button class="note" data-a="tab" data-id="products" style="border:0;text-align:left;width:100%"><span class="b">Do uzupełnienia: ${store.pending.length}</span><span>Kody zeskanowane bez internetu. Otwórz Produkty, żeby je sprawdzić.</span></button></div>` : ''}</div>`;
}

const foodRow = (kind: 'product' | 'recipe', id: string, meal?: Meal): string => {
  const f = food(kind, id); if (!f) return '';
  return `<button class="li" data-a="item" data-kind="${kind}" data-id="${id}"${meal ? ` data-meal="${meal}"` : ''}><span><span class="nm">${esc(f.name)}</span><br><span class="sub">${kind === 'recipe' ? '<span class="tag">przepis</span> · ' : ''}${kc(f.per100.kcal)} kcal / 100 g${f.sub && kind === 'product' ? ' · ' + esc(f.sub) : ''}</span></span>${ico('chev')}</button>`;
};
/** The way into Open Food Facts from a search field: the button with the typed text, or recent searches when the field is empty. */
function offEntry(primary: boolean, meal?: Meal): string {
  const q = store.ui.q.trim(); const m = meal ? ` data-meal="${esc(meal)}"` : '';
  if (q.length >= 2) return `<button class="btn ${primary ? 'pri ' : ''}block" data-a="offSearch"${m}>${ico('search')}<span class="clip">Szukaj „${esc(q)}” w Open Food Facts</span></button>`;
  if (q) return '';
  const rs = recentSearches(); if (!rs.length) return primary ? '<div class="meta">Wpisz nazwę, żeby szukać też w Open Food Facts.</div>' : '';
  return `<div class="cap">Ostatnio w Open Food Facts</div><div class="chips">${rs.map(r => `<button class="chip" data-a="offSearch" data-q="${esc(r)}"${m}>${esc(r)}</button>`).join('')}</div>`;
}
function filtered(q: string): { products: string[]; recipes: string[] } {
  const s = q.trim().toLowerCase(); const hit = (t: string) => !s || t.toLowerCase().includes(s);
  return { products: liveProducts().filter(p => hit(`${p.name} ${p.brand ?? ''} ${p.ean ?? ''}`)).sort((a, b) => a.name.localeCompare(b.name, 'pl')).map(p => p.id), recipes: liveRecipes().filter(r => hit(r.name)).sort((a, b) => a.name.localeCompare(b.name, 'pl')).map(r => r.id) };
}
export function viewProducts(): string {
  const { products, recipes } = filtered(store.ui.q);
  const pend = store.pending.map(p => `<div class="li has-ib"><span><span class="nm">EAN ${esc(p.ean)}</span><br><span class="sub">zeskanowany bez internetu</span></span><button class="btn" data-a="retry" data-ean="${esc(p.ean)}">${ico('refresh')}Sprawdź</button><button class="ib" data-a="dropPending" data-ean="${esc(p.ean)}" aria-label="Usuń kod ${esc(p.ean)}">${ico('x')}</button></div>`).join('');
  return `${brandTop()}<div class="stack"><div class="pad"><h1 class="title" id="page-title">Produkty</h1>
    <div class="inp"><input id="q" data-f="q" type="search" inputmode="search" enterkeyhint="search" placeholder="Szukaj nazwy, marki albo kodu" value="${esc(store.ui.q)}" aria-label="Szukaj"></div>
    <div data-live="offbtn">${offEntry(true)}</div>
    <div class="g2"><button class="btn" data-a="open" data-p="form">${ico('plus')}Nowy produkt</button><button class="btn" data-a="open" data-p="recipe">${ico('plus')}Nowy przepis</button></div></div>
    ${pend ? `<div class="pad"><div class="cap">Do uzupełnienia</div><div class="card list">${pend}</div></div>` : ''}
    <div class="pad"><div class="cap">Przepisy</div><div class="card list" data-live="rlist">${recipes.map(id => foodRow('recipe', id)).join('') || '<div class="empty">Brak przepisów. Przepis liczy makro na 100 g gotowego dania.</div>'}</div></div>
    <div class="pad"><div class="cap" data-live="pcount">Produkty · ${products.length}</div><div class="card list" id="plist" data-live="plist">${products.map(id => foodRow('product', id)).join('') || '<div class="empty">Brak produktów. Zeskanuj kod albo dodaj produkt z etykiety.</div>'}</div></div></div>`;
}

function progCal(): string {
  const tg = myTargets(); const today = localDate(); const [y, mo] = store.ui.month.split('-').map(Number) as [number, number];
  const first = new Date(y, mo - 1, 1); const daysIn = new Date(y, mo, 0).getDate(); const lead = (first.getDay() + 6) % 7;
  const ds = Array.from({ length: daysIn }, (_, i) => `${store.ui.month}-${String(i + 1).padStart(2, '0')}`);
  const filled = new Set(store.entries.map(e => e.date));
  const cells = Array(lead).fill('<span></span>').concat(ds.map(d => { const fut = d > today; const has = filled.has(d); const k = has ? dayKcal(store.entries, d) : 0;
    return `<button class="${fut ? 'future' : has ? '' : 'empty'} ${d === store.ui.sel ? 'sel' : ''} ${d === today ? 'today' : ''}" data-a="calSel" data-d="${d}" ${fut ? 'disabled' : ''} aria-label="${esc(dateWord(d))}: ${fut ? '' : has ? kc(k) + ' kcal' : 'nieuzupełniony'}"><b>${+d.slice(8)}</b><span class="k ${has && k <= tg.kcal * 1.05 ? 'ok' : ''}">${fut ? '' : has ? n1(k / 1000) + 'k' : '?'}</span></button>`; })).join('');
  const past = ds.filter(d => d <= today); const fd = past.filter(d => filled.has(d)); const avg = fd.length ? Math.round(fd.reduce((a, d) => a + dayKcal(store.entries, d), 0) / fd.length) : 0;
  const sel = store.ui.sel; const se = store.entries.filter(e => e.date === sel); const st = dayTotals(se); const diff = st.kcal - tg.kcal;
  const monthName = new Intl.DateTimeFormat('pl-PL', { month: 'long', year: 'numeric' }).format(first);
  return `<div class="row"><button class="ib" data-a="month" data-d="-1" aria-label="Poprzedni miesiąc" style="margin-left:-12px">${ico('back')}</button><span class="b grow cap1" style="text-align:center">${esc(monthName)}</span><button class="ib" data-a="month" data-d="1" aria-label="Następny miesiąc" style="margin-right:-12px" ${store.ui.month >= today.slice(0, 7) ? 'disabled style="visibility:hidden"' : ''}>${ico('chev')}</button></div>
    <div class="cal">${['pn', 'wt', 'śr', 'cz', 'pt', 'so', 'nd'].map(x => `<span class="h">${x}</span>`).join('')}${cells}</div>
    <div class="meta" id="calsum">${fd.length} z ${past.length} dni uzupełnionych${fd.length ? `, średnio <b>${kc(avg)} kcal</b> (cel ${kc(tg.kcal)})` : ''}. Dni z „?” nie liczą się jako 0.</div>
    <div class="card" id="calday"><div class="row"><span class="b grow cap1">${esc(dateWord(sel))}</span><span class="b">${se.length ? kc(st.kcal) + ' kcal' : 'nieuzupełniony'}</span></div>
      ${se.length ? `<div class="meta">${diff > 0 ? `${kc(diff)} ponad cel` : diff < 0 ? `${kc(-diff)} poniżej celu` : 'równo z celem'} · B ${n1(st.p)} g · T ${n1(st.f)} g · W ${n1(st.c)} g · błonnik ${n1(st.fiber ?? 0)} g · woda ${litres(waterOf(sel))}</div>` : `<div class="meta">Brak wpisów. To nie znaczy zero, tylko że dzień nie jest uzupełniony.${waterOf(sel) ? ` Woda ${litres(waterOf(sel))}.` : ''}</div>`}
      <div class="g2"><button class="btn" data-a="openDay" data-d="${sel}">Otwórz dzień</button>${se.length && sel !== today ? `<button class="btn" data-a="repeatDay" data-d="${sel}">${ico('copy')}Powtórz dziś</button>` : '<span></span>'}</div></div>`;
}
function progWeight(): string {
  const d = localDate(); const ws = [...store.weights].sort((a, b) => a.date.localeCompare(b.date)); const a = avg7(ws, d); const today = ws.find(w => w.date === d);
  const g = store.goal; const f = g ? forecast(ws, d, g.targetKg) : null; const adv = advise(ws, store.entries, d, g); const need = realNeed(ws, store.entries, d);
  const R = store.ui.range; const first = ws[0]?.date ?? d; const from = R && addDays(d, -R) > first ? addDays(d, -R) : first; /* never wider than the data */ const pts = ws.filter(w => w.date >= from);
  let chart = '';
  if (pts.length >= 2) {
    const fDate = f && f.kind === 'date' ? f.date : null; const end = fDate && R !== 30 ? fDate : d;
    const span = Math.max(1, (Date.parse(end) - Date.parse(from)) / 864e5); const avgs = pts.map(w => [w.date, avg7(ws, w.date, false)!] as const);
    const vals = [...pts.map(w => w.kg), ...(g ? [g.targetKg] : [])]; const mn = Math.min(...vals) - 0.4, mx = Math.max(...vals) + 0.4; const W = 320, H = 120;
    const px = (date: string) => ((Date.parse(date) - Date.parse(from)) / 864e5 / span) * W; const py = (kg: number) => H - 4 - ((kg - mn) / (mx - mn)) * (H - 8);
    const line = avgs.map(([dt, v], i) => `${i ? 'L' : 'M'}${px(dt).toFixed(1)} ${py(v).toFixed(1)}`).join(' '); const last = avgs[avgs.length - 1]!;
    chart = `<figure class="chart" style="margin:0"><svg viewBox="-6 -6 ${W + 12} ${H + 12}" role="img" aria-label="Średnia wagi z 7 dni od ${n1(avgs[0]![1])} do ${n1(last[1])} kg${g ? `, cel ${n1(g.targetKg)} kg` : ''}">
      ${g ? `<line x1="0" x2="${W}" y1="${py(g.targetKg).toFixed(1)}" y2="${py(g.targetKg).toFixed(1)}" stroke="var(--muted)" stroke-dasharray="4 4"/>` : ''}
      ${pts.map(w => `<circle cx="${px(w.date).toFixed(1)}" cy="${py(w.kg).toFixed(1)}" r="2.5" fill="var(--muted)"/>`).join('')}
      <path d="${line}" fill="none" stroke="var(--text)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      ${fDate && R !== 30 ? `<path d="M${px(last[0]).toFixed(1)} ${py(last[1]).toFixed(1)} L${px(fDate).toFixed(1)} ${py(g!.targetKg).toFixed(1)}" fill="none" stroke="var(--text)" stroke-width="2" stroke-dasharray="2 5" opacity=".6"/>` : ''}
      <circle cx="${px(last[0]).toFixed(1)}" cy="${py(last[1]).toFixed(1)}" r="4.5" fill="var(--accent)"/></svg>
      <figcaption class="legend"><span><i></i>średnia 7 dni</span><span><i class="dot"></i>pomiary</span>${g ? '<span><i class="dash"></i>cel i prognoza</span>' : ''}</figcaption></figure>
      <div class="seg" role="group" aria-label="Zakres">${[[30, '30 dni'], [90, '90 dni'], [0, 'Całość']].map(([v, l]) => `<button data-a="range" data-v="${v}" aria-pressed="${R === v}">${l}</button>`).join('')}</div>`;
  }
  const fc = !g ? `<button class="btn block" data-a="open" data-p="goal">Ustaw cel wagi</button>`
    : `<div class="card" id="forecast"><div class="row"><span class="cap grow">Prognoza · cel ${n1(g.targetKg)} kg</span><button class="btn ghost" data-a="open" data-p="goal" style="margin-right:-12px">Zmień</button></div>${!f || f.kind === 'noData' ? '<div class="meta">Potrzeba co najmniej 4 pomiarów w ciągu 10 dni. Prognoza pojawi się sama.</div>'
      : f.kind === 'reached' ? '<div class="b">Cel osiągnięty</div><div class="meta">Średnia z 7 dni jest przy celu. Możesz ustawić nowy albo przejść na utrzymanie.</div>'
      : f.kind === 'flat' ? `<div class="b">Waga stoi</div><div class="meta">${n1(f.perWeek)} kg tygodniowo w ostatnich 4 tygodniach. Przy tym tempie cel się nie przybliża.</div>`
      : f.kind === 'away' ? `<div class="b">Waga idzie w drugą stronę</div><div class="meta">${f.perWeek > 0 ? '+' : ''}${n1(f.perWeek)} kg tygodniowo w ostatnich 4 tygodniach.</div>`
      : `<div class="b">Ok. ${esc(dateLong(f.date))}</div><div class="meta">Zakres: ${esc(dateLong(f.early))} - ${esc(dateLong(f.late))}. Z tempa ${n1(Math.abs(f.perWeek))} kg tygodniowo w ostatnich 4 tygodniach, zmienia się po każdym pomiarze. Waga spada nierówno, więc to zakres, nie termin.</div>`}</div>`;
  const ADV: Record<string, [string, string]> = { fast: ['Za szybko', 'Przy takim tempie łatwiej o utratę mięśni i spadek sił.'], slow: ['Wolniej niż plan', 'Najpierw sprawdź, czy ważysz porcje, a nie szacujesz.'], flat: ['Stoi', 'Średnia prawie się nie zmienia.'], unsure: ['Za mało danych', 'Przez tydzień zapisuj każdy dzień, potem ocena wróci.'], ok: ['Tempo w normie', 'Nic nie trzeba zmieniać.'] };
  const showAdv = adv && !(store.settings.adviceUntil && store.settings.adviceUntil > d && adv.kind !== 'ok');
  const advHtml = adv && showAdv ? `<div class="note ${adv.kind === 'ok' ? '' : 'warn'}" id="advice"><span class="b">${ADV[adv.kind]![0]}</span><span>${adv.kind === 'unsure' ? `Uzupełnione ${adv.filled} z 14 dni, więc ocena tempa jest niepewna.` : `${adv.kgPerWeek > 0 ? '+' : ''}${n1(adv.kgPerWeek)} kg tygodniowo, ${n1(Math.abs(adv.pctPerWeek))}% masy. Plan: ${n1(PACE_PCT[g!.pace] * 100)}%. Uzupełnione ${adv.filled} z 14 dni.`} ${ADV[adv.kind]![1]}</span>${adv.deltaKcal ? `<span class="b">Propozycja: ${adv.deltaKcal > 0 ? '+' : '−'}${Math.abs(adv.deltaKcal)} kcal dziennie (cel ${kc(myTargets().kcal + adv.deltaKcal)}).</span><div class="g2"><button class="btn" data-a="applyAdvice" data-v="${adv.deltaKcal}">Zastosuj</button><button class="btn" data-a="dismissAdvice">Nie teraz</button></div>` : ''}</div>` : '';
  const formula = store.profile ? Math.round(tdee(store.profile, year()) / 10) * 10 : null;
  return `<div class="meta">Średnia z 7 dni${g ? ` · cel ${n1(g.targetKg)} kg` : ''}</div>
    <div class="row" style="align-items:baseline;gap:var(--s3)"><span class="hero" id="avg7">${a == null ? '—' : kg1(a) + ' kg'}</span>${f && (f.kind === 'date' || f.kind === 'away' || f.kind === 'flat') ? `<span class="meta">${f.perWeek > 0 ? '+' : f.perWeek < 0 ? '−' : '±'}${n1(Math.abs(f.perWeek))} kg / tydz.</span>` : ''}</div>
    ${chart || '<div class="empty">Wykres pojawi się po dwóch pomiarach. Waż się rano, po toalecie, przed jedzeniem: średnia z 7 dni wygładza wodę.</div>'}
    <div class="row" style="gap:var(--tap-gap);align-items:flex-end"><div class="grow">${field('kg', today ? 'Waga dziś (zmień)' : 'Waga dziś', store.ui.draft.kg ?? (today ? kg1(today.kg) : ''), 'kg', { ph: '0,0' })}</div><button class="btn" data-a="saveWeight">Zapisz</button></div>
    ${store.ui.err === 'kg' ? '<div class="err" role="alert">Wpisz wagę od 30 do 300 kg.</div>' : ''}
    ${fc}${advHtml}
    ${need ? `<div class="card" id="need"><div class="cap">Rzeczywiste zapotrzebowanie</div><div class="row" style="align-items:baseline;gap:var(--s2)"><span class="title">${kc(need.kcal)}</span><span class="mu">kcal na utrzymanie</span></div><div class="meta">Z ${need.filled} uzupełnionych dni z 21 i zmiany wagi (ok. 7700 kcal na kg).${formula ? ` Wzór daje ${kc(formula)}.` : ''} To szacunek, na podstawie Twoich wpisów.</div></div>` : ''}
    ${ws.length ? `<div class="cap">Ostatnie pomiary</div><div class="card list">${ws.slice(-7).reverse().map(w => `<div class="li has-ib"><span>${esc(fmtDay(w.date))}</span><span class="b">${kg1(w.kg)} kg</span><button class="ib" data-a="delWeight" data-d="${w.date}" aria-label="Usuń pomiar z ${esc(w.date)}">${ico('trash')}</button></div>`).join('')}</div>` : ''}`;
}
const shortDay = (d: string): string => new Intl.DateTimeFormat('pl-PL', { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(d + 'T12:00:00'));
const dateLong = (d: string): string => new Intl.DateTimeFormat('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(d + 'T12:00:00'));
function progWater(): string {
  const d = localDate(); const g = waterGoal(); const days = Array.from({ length: 14 }, (_, i) => addDays(d, -i)); const today = store.water.filter(w => w.date === d).sort((a, b) => b.at - a.at);
  return `<div class="meta">Dziś</div><div class="row" style="align-items:baseline;gap:var(--s2)"><span class="hero" id="wtoday">${litres(waterOf(d))}</span><span class="mu">z ${litres(g)}</span></div>
    <div class="g3"><button class="btn" data-a="water" data-v="250">+250 ml</button><button class="btn" data-a="water" data-v="330">+330 ml</button><button class="btn" data-a="water" data-v="500">+500 ml</button></div>
    <div class="row" style="gap:var(--tap-gap);align-items:flex-end"><div class="grow">${field('wml', 'Inna ilość', store.ui.draft.wml ?? '', 'ml', { mode: 'numeric', ph: '200' })}</div><button class="btn" data-a="waterCustom">Dodaj</button></div>
    ${store.ui.err === 'wml' ? '<div class="err" role="alert">Wpisz od 10 do 3000 ml.</div>' : ''}
    ${today.length ? `<div class="card list">${today.map(w => `<div class="li has-ib"><span>${new Date(w.at).toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</span><span class="b">${w.ml} ml</span><button class="ib" data-a="delWater" data-id="${w.id}" aria-label="Usuń ${w.ml} ml">${ico('trash')}</button></div>`).join('')}</div>` : ''}
    <div class="cap">Ostatnie 14 dni</div><div class="card list">${days.map(x => { const ml = waterOf(x); return `<div class="mac" style="min-height:36px"><span class="cap1">${esc(x === d ? 'Dziś' : shortDay(x))}</span><span class="bar"><i style="width:${g ? Math.min(100, (ml / g) * 100).toFixed(0) : 0}%"></i></span><span class="${ml ? 'b' : 'mu'}">${ml ? litres(ml) : 'brak'}</span></div>`; }).join('')}</div>
    ${field('wgoal', 'Cel na dzień', store.ui.draft.wgoal ?? String(store.settings.waterGoal ?? ''), 'ml', { mode: 'numeric', ph: String(g) })}
    <div class="meta">Propozycja ${kc(g)} ml to ok. 30 ml na kg masy. Zależy od upału, wysiłku i jedzenia, więc to tylko punkt startu.</div>
    <button class="btn block" data-a="saveWaterGoal">Zapisz cel wody</button>`;
}
export function viewProgress(): string {
  const P = store.ui.prog;
  return `${brandTop()}<div class="stack"><div class="pad"><h1 class="title" id="page-title">Postęp</h1>
    <div class="seg" role="tablist" aria-label="Postęp">${[['cal', 'Kalendarz'], ['weight', 'Waga'], ['water', 'Woda']].map(([k, l]) => `<button role="tab" data-a="prog" data-id="${k}" aria-pressed="${P === k}" aria-selected="${P === k}">${l}</button>`).join('')}</div>
    ${P === 'cal' ? progCal() : P === 'weight' ? progWeight() : progWater()}</div></div>`;
}

export function viewMore(): string {
  const th = store.settings.theme;
  const row = (p: string, t: string, s: string) => `<button class="li" data-a="open" data-p="${p}"><span><span class="nm">${t}</span><br><span class="sub">${s}</span></span>${ico('chev')}</button>`;
  return `${brandTop()}<div class="stack"><div class="pad"><h1 class="title" id="page-title">Więcej</h1>
    <div class="card list">${row('profile', 'Profil i cele', 'waga, wzrost, aktywność, kalorie i makro')}${row('meals', 'Posiłki', `${mealPlan().length} w układzie dnia: ${mealPlan().map(m => m.name).join(', ')}`)}${row('goal', 'Cel wagi', store.goal ? `${n1(store.goal.targetKg)} kg, tempo ${{ slow: 'spokojne', mod: 'umiarkowane', fast: 'szybkie' }[store.goal.pace]}` : 'nie ustawiony')}${row('backup', 'Kopia zapasowa', 'plik JSON z wszystkimi danymi')}${row('about', 'O aplikacji', `wersja ${VERSION}, źródło danych, prywatność`)}</div>
    <div class="lbl">Motyw</div><div class="seg" role="group" aria-label="Motyw">${[['system', 'Systemowy'], ['light', 'Jasny'], ['dark', 'Ciemny']].map(([k, l]) => `<button data-a="theme" data-id="${k}" aria-pressed="${th === k}">${l}</button>`).join('')}</div></div></div>`;
}
export const TAB_VIEWS: Record<string, () => string> = { today: viewToday, products: viewProducts, progress: viewProgress, more: viewMore };

/* ---------------- pages ---------------- */
function pageAdd(meal: Meal): string {
  const L = store.ui.list; const { products, recipes } = filtered(store.ui.q);
  const recent = [...new Map([...store.entries].sort((a, b) => b.at - a.at).map(e => [e.productId, e])).values()].slice(0, 12);
  let list = '';
  if (store.ui.q.trim()) list = [...recipes.map(id => foodRow('recipe', id, meal)), ...products.map(id => foodRow('product', id, meal))].join('');
  else if (L === 'recent') list = recent.map(e => foodRow(productById(e.productId) ? 'product' : 'recipe', e.productId, meal)).join('');
  else if (L === 'fav') list = liveProducts().filter(p => p.fav).map(p => foodRow('product', p.id, meal)).join('');
  else if (L === 'recipes') list = recipes.map(id => foodRow('recipe', id, meal)).join('');
  else list = products.map(id => foodRow('product', id, meal)).join('');
  const empty = { recent: 'Tu pojawi się to, co ostatnio jadłeś.', fav: 'Oznacz produkt serduszkiem, żeby był tutaj.', recipes: 'Brak przepisów.', all: 'Brak produktów.' }[L];
  return `${backTop('Dodaj do: ' + mealName(store.ui.date, meal))}<div class="scroll pscroll"><div class="stack"><div class="pad">
    <button class="btn pri block" data-a="scan" data-meal="${esc(meal)}">${ico('scan')}Skanuj kod</button>
    <div class="g3"><button class="btn" data-a="open" data-p="code" data-meal="${esc(meal)}">Wpisz kod</button><button class="btn" data-a="open" data-p="form" data-meal="${esc(meal)}">Z etykiety</button><button class="btn" data-a="open" data-p="quick" data-meal="${esc(meal)}">Szybkie kcal</button></div>
    <div class="inp"><input id="q" data-f="q" type="search" inputmode="search" enterkeyhint="search" placeholder="Szukaj w moich produktach" value="${esc(store.ui.q)}" aria-label="Szukaj"></div>
    <div data-live="offbtn">${offEntry(false, meal)}</div>
    <div data-live="atabs">${store.ui.q.trim() ? '' : `<div class="tabs" role="tablist">${[['recent', 'Ostatnie'], ['fav', 'Ulubione'], ['recipes', 'Przepisy'], ['all', 'Wszystkie']].map(([k, l]) => `<button role="tab" data-a="list" data-id="${k}" aria-selected="${L === k}">${l}</button>`).join('')}</div>`}</div>
    <div class="card list" id="alist" data-live="alist">${list || `<div class="empty">${store.ui.q.trim() ? 'Nic nie pasuje.' : empty}</div>`}</div></div></div></div>`;
}

function pageItem(p: Extract<Page, { t: 'item' }>): string {
  const f = food(p.kind, p.id); if (!f) return `${backTop('Brak')}<div class="pad"><div class="empty">Ten produkt został usunięty.</div></div>`;
  const prod = p.kind === 'product' ? productById(p.id) : undefined; const editing = !!p.entryId;
  const gStr = store.ui.draft.grams ?? String(p.grams ?? f.lastGrams ?? f.serving ?? 100).replace('.', ',');
  const g = parseFloat(gStr.replace(',', '.')); const ok = Number.isFinite(g) && g > 0 && g <= 5000; const m = forGrams(f.per100, ok ? g : 0);
  const chipSrc: [number | undefined, string][] = [[f.serving, `${f.serving} g porcja`], [f.lastGrams, `${f.lastGrams} g ostatnio`], [100, '100 g'], [f.pack, `${f.pack} g całość`]];
  const chips = [...new Map(chipSrc.filter((x): x is [number, string] => !!x[0] && x[0] > 0)).entries()];
  const showCheck = prod && prod.source === 'off' && !prod.checked;
  return `${backTop(f.name, p.kind === 'product' ? `<button class="ib" data-a="fav" data-id="${p.id}" aria-pressed="${!!f.fav}" aria-label="${f.fav ? 'Usuń z ulubionych' : 'Dodaj do ulubionych'}">${ico(f.fav ? 'heartf' : 'heart')}</button>` : '')}
    <div class="scroll pscroll"><div class="stack"><div class="pad">
    <div class="meta">${p.kind === 'recipe' ? 'Przepis · wartości na 100 g gotowego dania' : esc([prod?.brand, prod?.ean ? 'EAN ' + prod.ean : '', prod?.source === 'off' ? 'Open Food Facts' : 'Twój produkt'].filter(Boolean).join(' · '))}</div>
    <div class="g2">${field('grams', 'Ile', gStr, 'g', { invalid: !ok })}<div class="fld"><label for="meal">Posiłek</label><div class="inp"><select id="meal" data-f="meal">${dayMeals(store.ui.date).map(x => `<option value="${esc(x.id)}" ${x.id === p.meal ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div></div></div>
    <div data-live="gerr">${!ok ? '<div class="err" role="alert">Wpisz ilość od 1 do 5000 g.</div>' : ''}</div>
    ${chips.length ? `<div class="chips" data-live="gchips">${chips.map(([v, l]) => `<button class="chip" data-a="grams" data-v="${v}" aria-pressed="${ok && Math.abs(g - v) < 0.01}">${esc(l)}</button>`).join('')}</div>` : ''}
    <div class="card" data-live="gcard"><div class="row" style="align-items:baseline;gap:var(--s2)"><span class="hero" id="pkcal">${kc(m.kcal)}</span><span class="mu">kcal w ${ok ? n1(g) : 0} g</span></div>
      <div class="tbl"><span class="cap">Składnik</span><span class="cap">${ok ? n1(g) : 0} g</span><span class="cap">100 g</span>
        ${([['Białko', 'p'], ['Tłuszcze', 'f'], ['Węglowodany', 'c']] as [string, keyof Per100][]).map(([l, k]) => `<span>${l}</span><span class="b">${n1(m[k] ?? 0)} g</span><span class="mu">${n1(f.per100[k] ?? 0)} g</span>`).join('')}</div></div>
    ${showCheck ? `<div class="note warn"><span class="b">Porównaj z etykietą</span><span>Dane z Open Food Facts bywają z błędami albo niepełne. Jeśli coś się nie zgadza, popraw produkt. Twoja wersja zostaje w telefonie.</span><button class="btn" data-a="open" data-p="form" data-id="${p.id}" data-meal="${p.meal}">${ico('edit')}Popraw wartości</button></div>` : ''}
    <button class="btn pri block" data-live="gbtn" data-a="${editing ? 'saveEntry' : 'addEntry'}" ${ok ? '' : 'disabled'}>${editing ? 'Zapisz zmianę' : 'Dodaj do: ' + esc(mealName(store.ui.date, (store.ui.draft.meal as Meal) || p.meal))}</button>
    ${editing ? `<button class="btn danger block" data-a="delEntry">${ico('trash')}Usuń z dziennika</button>` : ''}
    ${!editing && p.kind === 'product' && !showCheck ? `<button class="btn ghost block" data-a="open" data-p="form" data-id="${p.id}">${ico('edit')}Edytuj produkt</button>` : ''}
    ${!editing && p.kind === 'recipe' ? `<button class="btn ghost block" data-a="open" data-p="recipe" data-id="${p.id}">${ico('edit')}Edytuj przepis</button>` : ''}</div></div></div>`;
}

const FORM_KEYS = ['name', 'brand', 'ean', 'kcal', 'p', 'f', 'c', 'fiber', 'serving', 'pack'] as const;
export function formDraft(): Record<string, string> {
  const p = page(); if (!p || p.t !== 'form') return {};
  const d = store.ui.draft; if (d.__init) return d;
  const prod = p.id ? productById(p.id) : undefined; const s = (v: number | undefined) => (v == null ? '' : String(v).replace('.', ','));
  const base: Record<string, string> = prod ? { name: prod.name, brand: prod.brand ?? '', ean: prod.ean ?? '', kcal: s(prod.per100.kcal), p: s(prod.per100.p), f: s(prod.per100.f), c: s(prod.per100.c), fiber: s(prod.per100.fiber), serving: s(prod.serving), pack: s(prod.pack) } : { ean: p.ean ?? '' };
  store.ui.draft = { ...Object.fromEntries(FORM_KEYS.map(k => [k, ''])), ...base, __init: '1' }; return store.ui.draft;
}
export const numOf = (s: string | undefined): number | null => { if (s == null || s.trim() === '') return null; const v = parseFloat(s.replace(',', '.')); return Number.isFinite(v) ? v : NaN; };
function pageForm(p: Extract<Page, { t: 'form' }>): string {
  const d = formDraft(); const err = store.ui.err;
  const per = { kcal: numOf(d.kcal) ?? 0, p: numOf(d.p) ?? 0, f: numOf(d.f) ?? 0, c: numOf(d.c) ?? 0, ...(numOf(d.fiber) ? { fiber: numOf(d.fiber)! } : {}) };
  const all = [d.kcal, d.p, d.f, d.c].every(v => v && v.trim()); const wrong = all && looksWrong(per);
  const intro = p.reason === 'notFound' ? `Kodu ${esc(p.ean)} nie ma w Open Food Facts. Przepisz z etykiety, wartości na 100 g.` : p.reason === 'incomplete' ? 'Open Food Facts ma ten produkt bez części wartości. Uzupełnij z etykiety, wartości na 100 g.' : 'Wartości z etykiety, na 100 g.';
  return `${backTop(p.id ? 'Popraw produkt' : 'Nowy produkt')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    <div class="meta">${intro}</div>
    ${field('name', 'Nazwa', d.name ?? '', '', { mode: 'text', ph: 'np. Twaróg półtłusty', invalid: err === 'name' })}
    <div class="g2">${field('brand', 'Marka (opcjonalnie)', d.brand ?? '', '', { mode: 'text' })}${field('ean', 'Kod EAN (opcjonalnie)', d.ean ?? '', '', { mode: 'numeric', invalid: err === 'ean' })}</div>
    <div class="g2">${field('kcal', 'Energia', d.kcal ?? '', 'kcal', { invalid: err === 'num' && !d.kcal })}${field('p', 'Białko', d.p ?? '', 'g', { invalid: err === 'num' && !d.p })}${field('f', 'Tłuszcze', d.f ?? '', 'g', { invalid: err === 'num' && !d.f })}${field('c', 'Węglowodany', d.c ?? '', 'g', { invalid: err === 'num' && !d.c })}</div>
    <div class="g3">${field('fiber', 'Błonnik', d.fiber ?? '', 'g')}${field('serving', 'Porcja', d.serving ?? '', 'g')}${field('pack', 'Całość', d.pack ?? '', 'g')}</div>
    <div data-live="ferr">${err === 'name' ? '<div class="err" role="alert">Wpisz nazwę.</div>' : err === 'num' ? '<div class="err" role="alert">Uzupełnij energię, białko, tłuszcze i węglowodany (liczby, 0 jest dozwolone).</div>' : err === 'ean' ? '<div class="err" role="alert">Kod nie wygląda na EAN: 8, 12 albo 13 cyfr z poprawną cyfrą kontrolną. Zostaw puste, jeśli nie masz kodu.</div>' : ''}</div>
    <div id="check" data-live="check">${wrong ? `<div class="note warn"><span class="b">Sprawdź wartości</span><span>Z makro wychodzi ${kc(kcalFromMacros(per))} kcal, a wpisane jest ${kc(per.kcal)}. Różnica ponad 15% albo ponad 100 g składników w 100 g zwykle oznacza literówkę.</span></div>` : all ? `<div class="note"><span class="b">Sprawdzenie</span><span>Z makro wychodzi ${kc(kcalFromMacros(per))} kcal, wpisane ${kc(per.kcal)}. Zgadza się.</span></div>` : ''}</div>
    <button class="btn pri block" data-a="saveProduct">${p.meal && !p.id ? 'Zapisz i dodaj' : 'Zapisz'}</button>
    ${p.id ? `<button class="btn danger block" data-a="delProduct">${ico('trash')}Usuń produkt</button>` : ''}</div></div></div>`;
}
function pageCode(meal: Meal): string {
  const v = store.ui.draft.code ?? '';
  return `${backTop('Wpisz kod')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    <div class="meta">Cyfry spod kodu kreskowego (8, 12 albo 13). Do Open Food Facts wysyłany jest tylko ten numer.</div>
    ${field('code', 'Kod EAN', v, '', { mode: 'numeric', ph: '5900000000000', invalid: store.ui.err === 'ean' })}
    ${store.ui.err === 'ean' ? '<div class="err" role="alert">To nie wygląda na kod EAN. Sprawdź cyfry, zwłaszcza ostatnią.</div>' : ''}
    <button class="btn pri block" data-a="lookup" data-meal="${meal}">Szukaj produktu</button></div></div></div>`;
}

function pageRecipe(): string {
  const r = store.ui.recipeDraft; if (!r) return '';
  const tot = r.items.reduce<Per100>((a, i) => { const m = forGrams(i.per100, i.grams); return { kcal: a.kcal + m.kcal, p: a.p + m.p, f: a.f + m.f, c: a.c + m.c }; }, { kcal: 0, p: 0, f: 0, c: 0 });
  const raw = r.items.reduce((a, i) => a + i.grams, 0); const w = r.cooked && r.cooked > 0 ? r.cooked : raw;
  return `${backTop(r.name || 'Nowy przepis')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    ${field('rname', 'Nazwa', r.name, '', { mode: 'text', ph: 'np. Owsianka z jogurtem', invalid: store.ui.err === 'name' })}
    <div class="cap">Składniki · surowe, w gramach</div>
    <div class="card list">${r.items.map((i, k) => `<div class="li has-ib" style="grid-template-columns:minmax(0,1fr) 112px var(--tap)"><span class="nm">${esc(i.name)}<br><span class="sub" data-live="ik${k}">${kc(forGrams(i.per100, i.grams).kcal)} kcal</span></span><div class="inp"><input data-f="ing" data-k="${k}" inputmode="decimal" value="${String(i.grams).replace('.', ',')}" aria-label="Gramy: ${esc(i.name)}"><small>g</small></div><button class="ib" data-a="dropIng" data-k="${k}" aria-label="Usuń składnik ${esc(i.name)}">${ico('x')}</button></div>`).join('') || '<div class="empty">Dodaj pierwszy składnik z listy produktów.</div>'}</div>
    <button class="btn block" data-a="open" data-p="pickIng">${ico('plus')}Dodaj składnik</button>
    ${field('cooked', 'Waga gotowego dania (opcjonalnie)', r.cooked ? String(r.cooked).replace('.', ',') : '', 'g', { ph: raw ? String(Math.round(raw)) : '' })}
    <div class="meta">Zważ garnek po ugotowaniu minus garnek. Bez tej wagi aplikacja liczy wagę surowych składników (${kc(raw)} g), co przy gotowaniu zaniża albo zawyża wynik.</div>
    ${field('servings', 'Liczba porcji (opcjonalnie)', r.servings ? String(r.servings) : '', 'porcji', { mode: 'numeric' })}
    <div class="card" data-live="rsum"><div class="row" style="align-items:baseline;gap:var(--s2)"><span class="hero" id="r100">${w ? kc((tot.kcal / w) * 100) : 0}</span><span class="mu">kcal na 100 g gotowego</span></div>
      <div class="meta">Całość: ${kc(tot.kcal)} kcal, ${n1(tot.p)} g białka, ${n1(tot.f)} g tłuszczu, ${n1(tot.c)} g węglowodanów, ${kc(w)} g</div></div>
    ${store.ui.err === 'items' ? '<div class="err" role="alert">Przepis potrzebuje nazwy i co najmniej jednego składnika.</div>' : ''}
    <button class="btn pri block" data-a="saveRecipe">Zapisz przepis</button>
    ${r.createdAt && recipeById(r.id) ? `<button class="btn danger block" data-a="delRecipe">${ico('trash')}Usuń przepis</button>` : ''}</div></div></div>`;
}
function pagePickIng(): string {
  const { products } = filtered(store.ui.q);
  return `${backTop('Wybierz składnik')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    <div class="inp"><input id="q" data-f="q" type="search" placeholder="Szukaj w moich produktach" value="${esc(store.ui.q)}" aria-label="Szukaj"></div>
    <div class="card list" data-live="ilist">${products.map(id => { const p = productById(id)!; return `<button class="li" data-a="pickIng" data-id="${id}"><span><span class="nm">${esc(p.name)}</span><br><span class="sub">${kc(p.per100.kcal)} kcal / 100 g</span></span>${ico('plus')}</button>`; }).join('') || '<div class="empty">Brak produktów. Najpierw dodaj produkt (skan albo etykieta).</div>'}</div></div></div></div>`;
}

const ACT = [['1', 'Siedzący tryb', 'praca przy biurku, mało ruchu'], ['2', 'Lekka aktywność', 'trening 1-3 razy w tygodniu'], ['3', 'Umiarkowana', 'trening 3-5 razy w tygodniu'], ['4', 'Wysoka', 'trening 6-7 razy w tygodniu'], ['5', 'Bardzo wysoka', 'praca fizyczna i codzienny trening']];
export function profileDraft(): Record<string, string> {
  const d = store.ui.draft; if (d.__init) return d; const p = store.profile; const o = store.overrides;
  store.ui.draft = { sex: p?.sex ?? 'm', birthYear: String(p?.birthYear ?? ''), heightCm: String(p?.heightCm ?? ''), weightKg: p ? String(p.weightKg).replace('.', ',') : '', activity: String(p?.activity ?? 3), goal: p?.goal ?? 'keep', proteinPerKg: String(p?.proteinPerKg ?? 1.8),
    okcal: o.kcal ? String(o.kcal) : '', op: o.p ? String(o.p) : '', of: o.f ? String(o.f) : '', oc: o.c ? String(o.c) : '', __init: '1' };
  return store.ui.draft;
}
export function draftProfile(d: Record<string, string>) {
  const by = numOf(d.birthYear), h = numOf(d.heightCm), w = numOf(d.weightKg);
  if (!by || !h || !w || by < year() - 100 || by > year() - 14 || h < 120 || h > 230 || w < 30 || w > 300) return null;
  return { sex: d.sex as 'f' | 'm', birthYear: by, heightCm: h, weightKg: w, activity: (+d.activity! || 3) as 1 | 2 | 3 | 4 | 5, goal: d.goal as 'cut' | 'keep' | 'bulk', proteinPerKg: +d.proteinPerKg! || 1.8 };
}
function pageProfile(first: boolean): string {
  const d = profileDraft(); const prof = draftProfile(d);
  const ov = { ...(numOf(d.okcal) ? { kcal: numOf(d.okcal)! } : {}), ...(numOf(d.op) ? { p: numOf(d.op)! } : {}), ...(numOf(d.of) ? { f: numOf(d.of)! } : {}), ...(numOf(d.oc) ? { c: numOf(d.oc)! } : {}) };
  const calc = prof ? calcTargets(prof, year()) : null; const fin = prof ? calcTargets(prof, year(), ov) : null;
  const seg = (k: string, opts: [string, string][], label: string) => `<div class="lbl">${label}</div><div class="seg" role="group" aria-label="${label}">${opts.map(([v, l]) => `<button data-a="pf" data-k="${k}" data-v="${v}" aria-pressed="${d[k] === v}">${l}</button>`).join('')}</div>`;
  return `${backTop(first ? 'Twoje cele' : 'Profil i cele')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    ${first ? '<div class="meta">Z tych danych aplikacja policzy kalorie i makro na dzień. Każdą liczbę możesz potem nadpisać. Dane zostają w telefonie.</div>' : ''}
    ${seg('sex', [['f', 'Kobieta'], ['m', 'Mężczyzna']], 'Płeć (do wzoru na przemianę materii)')}
    <div class="g3">${field('birthYear', 'Rok urodzenia', d.birthYear ?? '', '', { mode: 'numeric', ph: '1990' })}${field('heightCm', 'Wzrost', d.heightCm ?? '', 'cm', { mode: 'numeric', ph: '175' })}${field('weightKg', 'Waga', d.weightKg ?? '', 'kg', { ph: '75' })}</div>
    <div class="lbl">Aktywność</div><div style="display:flex;flex-direction:column;gap:var(--tap-gap)" role="radiogroup" aria-label="Aktywność">${ACT.map(([v, t, s]) => `<button class="radio" role="radio" data-a="pf" data-k="activity" data-v="${v}" aria-checked="${d.activity === v}"><span><span class="b">${t}</span><br><span class="meta">${s}</span></span><span class="dot"></span></button>`).join('')}</div>
    ${seg('goal', [['cut', 'Redukcja'], ['keep', 'Utrzymanie'], ['bulk', 'Masa']], 'Cel')}
    ${seg('proteinPerKg', [['1.6', '1,6'], ['1.8', '1,8'], ['2', '2,0'], ['2.2', '2,2']], 'Białko na kg masy ciała (g)')}
    ${store.ui.err === 'profile' ? '<div class="err" role="alert">Sprawdź rok urodzenia (14-100 lat), wzrost (120-230 cm) i wagę (30-300 kg).</div>' : ''}
    <div class="card" data-live="tcard"><div class="cap">Cel na dzień</div>
      ${fin ? `<div class="row" style="align-items:baseline;gap:var(--s2)"><span class="hero" id="tkcal">${kc(fin.kcal)}</span><span class="mu">kcal</span></div><div class="meta">Białko ${fin.p} g · tłuszcze ${fin.f} g · węglowodany ${fin.c} g</div>` : '<div class="empty">Uzupełnij rok urodzenia, wzrost i wagę.</div>'}
      <div class="meta">Wzór Mifflin-St Jeor razy aktywność, redukcja −20%, masa +10%. Tłuszcze co najmniej 0,8 g na kg, węglowodany to reszta. To szacunek, nie porada medyczna. Przy chorobie, ciąży albo zaburzeniach odżywiania ustal cele z lekarzem lub dietetykiem.</div></div>
    <div class="cap">Własne wartości (opcjonalnie)</div>
    <div class="g2">${field('okcal', 'Kalorie', d.okcal ?? '', 'kcal', { mode: 'numeric', ph: calc ? String(calc.kcal) : '' })}${field('op', 'Białko', d.op ?? '', 'g', { mode: 'numeric', ph: calc ? String(calc.p) : '' })}${field('of', 'Tłuszcze', d.of ?? '', 'g', { mode: 'numeric', ph: calc ? String(calc.f) : '' })}${field('oc', 'Węglowodany', d.oc ?? '', 'g', { mode: 'numeric', ph: calc ? String(calc.c) : '' })}</div>
    <button class="btn pri block" data-a="saveProfile">Zapisz cele</button></div></div></div>`;
}
function pageBackup(): string {
  return `${backTop('Kopia zapasowa')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    <div class="meta">Plik JSON z produktami, dziennikiem, przepisami, wagą i celami. Trzymaj go poza telefonem: odinstalowanie aplikacji kasuje dane.</div>
    <button class="btn pri block" data-a="export">Zapisz kopię</button>
    <div class="lbl">Wczytaj kopię</div><div class="meta">Zastępuje wszystkie dane w aplikacji danymi z pliku. Przed tym zapisz bieżącą kopię.</div>
    <label class="btn block" for="importFile">Wybierz plik</label><input id="importFile" data-f="importFile" type="file" accept="application/json,.json" hidden>
    ${store.ui.err ? `<div class="err" role="alert">${esc(store.ui.err)}</div>` : ''}</div></div></div>`;
}
function pageAbout(): string {
  return `${backTop('O aplikacji')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    <div class="row">${mark(48)}<div><div class="b">Fuelsmith ${esc(VERSION)}</div><div class="meta">Dziennik jedzenia, offline, dane w telefonie</div></div></div>
    <div class="card"><div class="b">Skąd są dane produktów</div><div class="meta">Po zeskanowaniu kodu albo wyszukaniu nazwy aplikacja pyta Open Food Facts (openfoodfacts.org), otwartą bazę produktów tworzoną przez użytkowników. Dane są na licencji Open Database License (ODbL). Mogą mieć błędy: porównaj je z etykietą przy pierwszym skanie.</div></div>
    <div class="card"><div class="b">Prywatność</div><div class="meta">Do Open Food Facts wysyłany jest tylko numer kodu kreskowego albo wpisany tekst wyszukiwania z filtrami. Ostatnie wyszukiwania zapisują się tylko w telefonie. Dziennik, waga i cele zostają w telefonie. Nie ma konta ani serwera. Skaner rozpoznaje kod w telefonie.</div></div>
    <div class="card"><div class="b">Ważne</div><div class="meta">Cele i przeliczenia to szacunki, nie porada medyczna.</div></div></div></div></div>`;
}
function pageQuick(p: Extract<Page, { t: 'quick' }>): string {
  const e = p.entryId ? store.entries.find(x => x.id === p.entryId) : undefined; const d = store.ui.draft;
  if (!d.__init) { const s = (v?: number) => (v ? String(v).replace('.', ',') : ''); store.ui.draft = { qname: e?.name ?? '', qkcal: s(e?.per100.kcal), qp: s(e?.per100.p), qf: s(e?.per100.f), qc: s(e?.per100.c), meal: e?.meal ?? p.meal, __init: '1' }; }
  const v = store.ui.draft;
  return `${backTop(e ? 'Szybkie kalorie' : 'Szybkie kalorie')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    <div class="meta">Gdy nie znasz produktu, np. obiad na mieście. Lepiej wpisać szacunek niż zostawić dzień pusty.</div>
    ${field('qname', 'Co to było (opcjonalnie)', v.qname ?? '', '', { mode: 'text', ph: 'np. Obiad na mieście' })}
    <div class="g2">${field('qkcal', 'Kalorie', v.qkcal ?? '', 'kcal', { mode: 'numeric', invalid: store.ui.err === 'qkcal' })}<div class="fld"><label for="meal">Posiłek</label><div class="inp"><select id="meal" data-f="meal">${dayMeals(store.ui.date).map(x => `<option value="${esc(x.id)}" ${x.id === (v.meal || p.meal) ? 'selected' : ''}>${esc(x.name)}</option>`).join('')}</select></div></div></div>
    <div class="g3">${field('qp', 'Białko', v.qp ?? '', 'g')}${field('qf', 'Tłuszcze', v.qf ?? '', 'g')}${field('qc', 'Węgle', v.qc ?? '', 'g')}</div>
    <div class="meta">Makro opcjonalne. Bez niego liczą się tylko kalorie.</div>
    ${store.ui.err === 'qkcal' ? '<div class="err" role="alert">Wpisz kalorie od 1 do 5000.</div>' : ''}
    <button class="btn pri block" data-a="saveQuick">${e ? 'Zapisz zmianę' : 'Dodaj'}</button>
    ${e ? `<button class="btn danger block" data-a="delEntry">${ico('trash')}Usuń z dziennika</button>` : ''}</div></div></div>`;
}
function pageDayMeal(): string {
  const ms = dayMeals(store.ui.date); const v = store.ui.draft; const name = v.mname ?? ''; const after = v.after ?? ms[ms.length - 1]?.id ?? '';
  return `${backTop('Dodaj posiłek')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    <div class="meta">Tylko ${store.ui.date === localDate() ? 'na dziś' : 'do tego dnia'}. Stały układ dnia ustawiasz w Więcej → Posiłki.</div>
    <div class="cap">Propozycje</div>
    <div class="chips" data-live="msug">${MEAL_SUGGESTIONS.filter(n => !ms.some(m => m.name === n)).map(n => `<button class="chip" data-a="mname" data-v="${esc(n)}" aria-pressed="${name === n}">${esc(n)}</button>`).join('')}</div>
    ${field('mname', 'Albo własna nazwa', name, '', { mode: 'text', ph: 'np. Kolacja po treningu', invalid: store.ui.err === 'mname' })}
    <div class="fld"><label for="after">Gdzie w dniu</label><div class="inp"><select id="after" data-f="after"><option value="__first" ${after === '__first' ? 'selected' : ''}>Na początku</option>${ms.map(m => `<option value="${esc(m.id)}" ${m.id === after ? 'selected' : ''}>po: ${esc(m.name)}</option>`).join('')}</select></div></div>
    ${store.ui.err === 'mname' ? '<div class="err" role="alert">Wpisz albo wybierz nazwę.</div>' : ''}
    <button class="btn pri block" data-a="addDayMeal">Dodaj posiłek</button></div></div></div>`;
}
function pageMeals(): string {
  const ms = mealPlan();
  return `${backTop('Posiłki')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    <div class="meta">Układ każdego nowego dnia. Dni, które już mają wpisy, zostają bez zmian. Pusty posiłek usuniesz z jednego dnia na ekranie Dziś.</div>
    <div class="card list">${ms.map((m, k) => `<div class="li mrow"><div class="inp"><input data-f="mrename" data-k="${k}" value="${esc(m.name)}" aria-label="Nazwa posiłku ${k + 1}" maxlength="30"></div><button class="ib" data-a="mmove" data-k="${k}" data-d="-1" aria-label="Wyżej: ${esc(m.name)}" ${k === 0 ? 'disabled' : ''}>${ico('up')}</button><button class="ib" data-a="mmove" data-k="${k}" data-d="1" aria-label="Niżej: ${esc(m.name)}" ${k === ms.length - 1 ? 'disabled' : ''}>${ico('down')}</button><button class="ib" data-a="mdel" data-k="${k}" aria-label="Usuń: ${esc(m.name)}" ${ms.length <= 1 ? 'disabled' : ''}>${ico('x')}</button></div>`).join('')}</div>
    <button class="btn block" data-a="madd" ${ms.length >= MAX_MEALS ? 'disabled' : ''}>${ico('plus')}Dodaj posiłek</button>
    <div class="cap">Gotowe układy</div>
    <div class="chips">${MEAL_PRESETS.map((pr, k) => `<button class="chip" data-a="mpreset" data-k="${k}">${esc(pr.name)}</button>`).join('')}</div>
    <div class="meta">Najwyżej ${MAX_MEALS} posiłków. Nazwę zmieniasz, pisząc w polu.</div></div></div></div>`;
}
function pageGoal(): string {
  const cur = currentKg(); const v = store.ui.draft; const g = store.goal;
  if (!v.__init) store.ui.draft = { gkg: g ? String(g.targetKg).replace('.', ',') : '', pace: g?.pace ?? 'mod', __init: '1' };
  const d = store.ui.draft; const t = numOf(d.gkg); const pace = (d.pace as Pace) || 'mod'; const ok = !!t && t >= 30 && t <= 300 && cur != null;
  const goal = ok ? { targetKg: t!, pace, setAt: localDate() } : null;
  const perWeek = cur ? cur * PACE_PCT[pace] : 0; const dk = goal && cur ? paceKcal(cur, goal) : 0;
  const base = store.profile ? tdee(store.profile, year()) : null; const kcal = base != null ? Math.round((base + dk) / 10) * 10 : null;
  const planDate = goal && cur && perWeek ? addDays(localDate(), Math.round(planWeeks(cur, goal) * 7)) : null;
  const f = goal ? forecast(store.weights, localDate(), goal.targetKg) : null;
  return `${backTop('Cel wagi')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    ${cur == null ? '<div class="note warn"><span class="b">Najpierw waga</span><span>Wpisz wagę w Postęp → Waga albo w profilu.</span></div>' : ''}
    <div class="g2"><div class="fld"><span class="lbl">Teraz (średnia 7 dni)</span><div class="inp"><span style="padding:0 var(--s3);font-weight:700">${cur ? kg1(cur) : '—'}</span><small>kg</small></div></div>${field('gkg', 'Cel', d.gkg ?? '', 'kg', { invalid: store.ui.err === 'gkg' })}</div>
    <div class="lbl">Tempo, które planujesz</div>
    <div class="seg" role="group" aria-label="Tempo">${([['slow', 'Spokojne'], ['mod', 'Umiarkowane'], ['fast', 'Szybkie']] as [Pace, string][]).map(([k, l]) => `<button data-a="gpace" data-v="${k}" aria-pressed="${pace === k}">${l}</button>`).join('')}</div>
    <div class="card" data-live="gplan">${goal && cur ? `<div class="meta">${n1(PACE_PCT[pace] * 100)}% masy na tydzień, czyli ${n1(perWeek)} kg. ${dk ? `${dk < 0 ? 'Deficyt' : 'Nadwyżka'} ok. ${kc(Math.abs(dk))} kcal dziennie${kcal ? `, cel kalorii ${kc(kcal)}` : ''}.` : 'Cel równy obecnej wadze: utrzymanie.'}</div>
      ${planDate && dk ? `<div class="row"><span class="grow">Z planu</span><span class="b">ok. ${esc(dateLong(planDate))}</span></div>` : ''}
      ${f && f.kind === 'date' ? `<div class="row"><span class="grow">Z Twoich pomiarów</span><span class="b">ok. ${esc(dateLong(f.date))}</span></div>` : f && f.kind === 'noData' ? '<div class="meta">Prognoza z pomiarów pojawi się po 4 pomiarach w 10 dni.</div>' : ''}` : '<div class="meta">Wpisz cel od 30 do 300 kg.</div>'}</div>
    <div class="note"><span class="b">Podpowiedzi, nie automat</span><span>Aplikacja nie zmienia sama kalorii ani celu. Gdy tempo odbiega od planu przez 2 tygodnie, pokaże w Postęp → Waga propozycję i powód. Decyzja jest Twoja. To szacunki, nie porada medyczna.</span></div>
    ${store.overrides.kcal != null ? `<div class="note warn"><span class="b">Masz własny cel kalorii (${kc(store.overrides.kcal)})</span><span>Dopóki jest ustawiony w profilu, tempo nie zmienia kalorii. Usuń go w Profil i cele, żeby kalorie szły za tempem.</span></div>` : ''}
    ${store.ui.err === 'gkg' ? '<div class="err" role="alert">Wpisz cel od 30 do 300 kg.</div>' : ''}
    <button class="btn pri block" data-a="saveGoal" ${cur == null ? 'disabled' : ''}>Zapisz cel</button>
    ${g ? `<button class="btn danger block" data-a="delGoal">${ico('trash')}Usuń cel</button>` : ''}</div></div></div>`;
}
/* ---------------- 0.5: Open Food Facts search ---------------- */
const filterChips = (f: Filters): [string, string][] => [
  ...CATEGORIES.filter(c => f.cats.includes(c.id)).map(c => [`cat:${c.id}`, c.name] as [string, string]),
  ...LABELS.filter(l => f.labels.includes(l.id)).map(l => [`label:${l.id}`, l.name] as [string, string]),
  ...(f.poland ? [['poland:', 'W Polsce'] as [string, string]] : []), ...(f.full ? [['full:', 'Pełne makro'] as [string, string]] : [])];
function offRow(i: number): string {
  const x = store.ui.off.hits[i]!; const v = x.per100!; const bad = looksWrong(v);
  const sub = [x.brand, x.pack ? `${x.pack} g` : '', `B ${n1(v.p)} · T ${n1(v.f)} · W ${n1(v.c)}`].filter(Boolean).join(' · ');
  return `<button class="li" data-a="offPick" data-i="${i}"><span><span class="nm">${esc(x.name)}</span><br><span class="sub">${esc(sub)}</span>${bad ? '<br><span class="tag warn-t">wartości się nie zgadzają</span>' : ''}${x.missing.length ? '<br><span class="tag">niepełne dane</span>' : ''}</span><span class="kcr"><b>${kc(v.kcal)}</b><br><span class="sub">kcal/100 g</span></span></button>`;
}
function offSheet(): string {
  const d = store.ui.off.draftF; const chip = (a: string, id: string, name: string, on: boolean) => `<button class="chip" data-a="${a}" data-id="${id}" aria-pressed="${on}">${esc(name)}</button>`;
  const sw = (id: 'poland' | 'full', name: string, hint: string) => `<button class="li sw" role="switch" aria-checked="${d[id]}" data-a="offToggle" data-id="${id}"><span><span class="nm">${name}</span><br><span class="sub">${hint}</span></span><span class="b">${d[id] ? 'Tak' : 'Nie'}</span></button>`;
  return `<div class="scrim" data-a="offClose"></div><div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sheet-t">
    <div class="row"><h2 class="b grow" id="sheet-t">Filtry</h2><button class="ib" data-a="offClose" aria-label="Zamknij filtry">${ico('x')}</button></div>
    <div class="sheet-b">
    <div class="cap">Kategoria</div><div class="chips">${CATEGORIES.map(c => chip('offCat', c.id, c.name, d.cats.includes(c.id))).join('')}</div>
    <div class="cap">Z etykiety producenta</div><div class="chips">${LABELS.map(l => chip('offLabel', l.id, l.name, d.labels.includes(l.id))).join('')}</div>
    <div class="meta">Tylko produkty z takim oznaczeniem. Brak oznaczenia nie znaczy, że produkt go nie spełnia. Przy alergii sprawdź opakowanie.</div>
    <div class="card list">${sw('poland', 'Sprzedawane w Polsce', 'Bez tego większość wyników jest z innych krajów')}${sw('full', 'Tylko z pełnym makro', 'Białko, tłuszcze i węglowodany na 100 g')}</div>
    <div class="cap">Sortowanie</div><div class="chips">${SORTS.map(o => chip('offSort', o.id, o.name, d.sort === o.id)).join('')}</div></div>
    <div class="g2"><button class="btn" data-a="offClear">Wyczyść</button><button class="btn pri" data-a="offApply">Pokaż wyniki</button></div></div>`;
}
function pageOffs(): string {
  const o = store.ui.off; const meal = (page() as { meal?: Meal }).meal;
  const n = activeCount(o.f); const chips = filterChips(o.f);
  const order = sortHits(o.hits.map((h, i) => ({ ...h, __i: i })), o.q, o.f.sort).map(h => (h as unknown as { __i: number }).__i);
  const more = o.status === 'ok' && o.page < o.pages && o.hits.length > 0;
  const manual = `<button class="btn block" data-a="open" data-p="form"${meal ? ` data-meal="${esc(meal)}"` : ''}>${ico('plus')}Dodaj produkt z etykiety</button>`;
  let body = '';
  if (o.status === 'loading' && !o.hits.length) body = `<div class="meta" role="status">Szukam „${esc(o.q)}” w Open Food Facts…</div>`;
  else if (o.status === 'offline') body = `<div class="note warn" role="alert"><span class="b">Brak połączenia</span><span>Nie ma internetu albo Open Food Facts nie odpowiada. Twoje produkty działają bez sieci.</span><button class="btn" data-a="offGo">${ico('refresh')}Spróbuj ponownie</button></div>${manual}`;
  else if (o.status === 'error') body = `<div class="note warn" role="alert"><span class="b">Open Food Facts zwrócił błąd</span><span>${esc(o.detail ?? '')}. Spróbuj za chwilę albo dodaj produkt z etykiety.</span><button class="btn" data-a="offGo">${ico('refresh')}Spróbuj ponownie</button></div>${manual}`;
  else if (o.status === 'limit') body = `<div class="note warn" role="alert"><span class="b">Chwila przerwy</span><span>Open Food Facts pozwala na 10 wyszukiwań na minutę. Spróbuj za ${o.wait} s. Skanowanie kodu działa dalej.</span><button class="btn" data-a="offGo">${ico('refresh')}Szukaj ponownie</button></div>`;
  else if (o.status === 'ok' && !o.hits.length) body = `<div class="note"><span class="b">Nic nie znaleziono</span><span>Spróbuj jednego słowa w podstawowej formie, np. „jogurt”${n > 1 ? ', albo usuń część filtrów' : ''}. Produkty bez kodu kreskowego (owoce na wagę, mięso z lady) są w Open Food Facts rzadko.</span></div>${manual}`;
  if (o.hits.length) body += `<div class="row"><span class="cap grow" id="ocount">Wyniki · ${o.hits.length} z ${o.count}</span><span class="cap">${esc(SORTS.find(x => x.id === o.f.sort)!.name)}</span></div>
    <div class="card list" id="olist">${order.map(offRow).join('')}</div>
    ${more ? `<button class="btn block" data-a="offMore" ${o.status === 'loading' ? 'disabled' : ''}>${o.status === 'loading' ? 'Wczytuję…' : `Pokaż kolejne ${PAGE_N}`}</button>` : ''}`;
  return `${backTop('Open Food Facts')}<div class="scroll pscroll"><div class="stack"><div class="pad">
    <div class="srow"><div class="inp grow"><input id="oq" data-f="oq" type="search" inputmode="search" enterkeyhint="search" autocomplete="off" value="${esc(o.q)}" aria-label="Szukaj w Open Food Facts" placeholder="Nazwa produktu"></div><button class="btn ${o.sheet ? '' : 'pri'}" data-a="offGo">${ico('search')}Szukaj</button></div>
    <div class="chips"><button class="chip" data-a="offSheet" aria-haspopup="dialog">${ico('settings')}Filtry${n ? ` · ${n}` : ''}</button>${chips.map(([id, name]) => `<button class="chip" data-a="offDrop" data-id="${id}" aria-pressed="true" aria-label="Usuń filtr: ${esc(name)}">${esc(name)}${ico('x')}</button>`).join('')}</div>
    ${body}
    <div class="meta">Dane: Open Food Facts, licencja ODbL. Do serwera trafia tylko wpisany tekst i filtry. Wartości porównaj z etykietą.</div></div></div></div>
    ${o.sheet ? offSheet() : ''}`;
}
const PAGE_N = 20;
export function pageHtml(): string {
  const p = page(); if (!p) return '';
  switch (p.t) {
    case 'add': return pageAdd(p.meal); case 'item': return pageItem(p); case 'form': return pageForm(p); case 'code': return pageCode(p.meal);
    case 'recipe': return pageRecipe(); case 'pickIng': return pagePickIng(); case 'profile': return pageProfile(!!p.first); case 'backup': return pageBackup(); case 'about': return pageAbout();
    case 'quick': return pageQuick(p); case 'dayMeal': return pageDayMeal(); case 'meals': return pageMeals(); case 'goal': return pageGoal(); case 'offs': return pageOffs();
  }
}
export { mark };
