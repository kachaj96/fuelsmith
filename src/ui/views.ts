/* Every screen as an HTML string. Values from storage always go through esc(). Actions are data-a attributes (actions.ts). */
import { addDays, avg7, avgKcal, dayTotals, entryMacros, forGrams, looksWrong, kcalFromMacros, MEALS, r1, targets as calcTargets, weeklyChange, type Meal, type Per100 } from '../domain/nutrition';
import { PART_PATHS, RADIUS, TILE } from '../brand-art';
import { VERSION } from '../version';
import { food, liveProducts, liveRecipes, localDate, MEAL_NAME, MEAL_TO, mealNow, myTargets, page, productById, recipeById, store, year, type Page } from './state';

export const esc = (s: unknown): string => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
const IC: Record<string, string> = {
  today: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>', products: '<path d="M4 5h11a3 3 0 0 1 3 3v12H7a3 3 0 0 1-3-3z"/><path d="M8 9h6M8 13h6"/>',
  progress: '<path d="M3 20h18M5 16l4-5 4 3 6-8"/>', more: '<circle cx="5" cy="12" r="1.6"/><circle cx="12" cy="12" r="1.6"/><circle cx="19" cy="12" r="1.6"/>',
  plus: '<path d="M12 5v14M5 12h14"/>', back: '<path d="M15 6l-6 6 6 6"/>', chev: '<path d="M9 6l6 6-6 6"/>', settings: '<path d="M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M1 14h6M9 8h6M17 16h6"/>',
  scan: '<path d="M4 8V5a1 1 0 0 1 1-1h3M16 4h3a1 1 0 0 1 1 1v3M20 16v3a1 1 0 0 1-1 1h-3M8 20H5a1 1 0 0 1-1-1v-3M7 9v6M10 9v6M13 9v6M17 9v6"/>',
  heart: '<path d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>', heartf: '<path fill="currentColor" d="M12 20s-7-4.4-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.6-7 10-7 10z"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>', x: '<path d="M18 6L6 18M6 6l12 12"/>', refresh: '<path d="M20 11a8 8 0 1 0-2.3 5.7"/><path d="M20 4v7h-7"/>',
  edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/>',
};
export const ico = (n: string): string => `<svg class="ico" viewBox="0 0 24 24" aria-hidden="true" focusable="false">${IC[n] ?? ''}</svg>`;
const mark = (s = 24): string => `<svg viewBox="0 0 1024 1024" width="${s}" height="${s}" aria-hidden="true"><rect width="1024" height="1024" rx="${RADIUS}" fill="${TILE}"/>${PART_PATHS.map(d => `<path fill="#fff" d="${d}"/>`).join('')}</svg>`;
const n1 = (x: number): string => String(r1(x)).replace('.', ',');
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

export function viewToday(): string {
  const d = store.ui.date, tg = myTargets(); const day = store.entries.filter(e => e.date === d);
  const tot = dayTotals(day); const left = tg.kcal - tot.kcal; const isToday = d === localDate();
  const meals = MEALS.map(m => {
    const es = day.filter(e => e.meal === m).sort((a, b) => a.at - b.at); const k = es.reduce((a, e) => a + entryMacros(e).kcal, 0);
    return `<div class="meal"><div class="meal-h"><span class="b">${MEAL_NAME[m]}</span><span class="${es.length ? 'b' : 'mu'}">${es.length ? kc(k) + ' kcal' : '—'}</span><button class="ib" data-a="open" data-p="add" data-meal="${m}" aria-label="Dodaj do: ${MEAL_NAME[m]}">${ico('plus')}</button></div>
      ${es.map(e => `<button class="ent" data-a="entry" data-id="${e.id}"><span class="nm">${esc(e.name)} <span class="mu">${n1(e.grams)} g</span></span><span class="mu">${kc(entryMacros(e).kcal)} kcal</span></button>`).join('')}</div>`;
  }).join('');
  return `${brandTop()}<div class="stack">
    <div class="pad"><div class="datebar"><button class="ib" data-a="day" data-d="-1" aria-label="Poprzedni dzień">${ico('back')}</button><span class="mid meta cap1">${esc(fmtDay(d))}${store.profile ? ` · cel: ${{ cut: 'redukcja', keep: 'utrzymanie', bulk: 'masa' }[store.profile.goal]}` : ''}</span><button class="ib" data-a="day" data-d="1" aria-label="Następny dzień" ${isToday ? 'disabled style="visibility:hidden"' : ''}>${ico('chev')}</button></div>
      <div class="row" style="align-items:baseline;gap:var(--s2)"><span class="hero" id="left">${kc(Math.abs(left))}</span><span class="mu">${left >= 0 ? 'kcal zostało' : 'kcal ponad cel'}</span></div>
      <div class="meta">${kc(tot.kcal)} z ${kc(tg.kcal)} kcal</div>
      <div style="display:flex;flex-direction:column;gap:var(--s1)">${macRow('Białko', tot.p, tg.p)}${macRow('Tłuszcze', tot.f, tg.f)}${macRow('Węglowodany', tot.c, tg.c)}</div>
      <button class="btn pri block" data-a="scan" data-meal="${mealNow()}">${ico('scan')}Skanuj produkt</button>
      ${!store.profile ? `<div class="note"><span class="b">Cele są domyślne (2000 kcal).</span><span>Uzupełnij profil, a aplikacja policzy je z Twojej wagi, wzrostu i aktywności.</span><button class="btn" data-a="open" data-p="profile">Uzupełnij profil</button></div>` : ''}</div>
    <div class="pad"><div class="card list">${meals}</div></div>
    ${store.pending.length ? `<div class="pad"><button class="note" data-a="tab" data-id="products" style="border:0;text-align:left;width:100%"><span class="b">Do uzupełnienia: ${store.pending.length}</span><span>Kody zeskanowane bez internetu. Otwórz Produkty, żeby je sprawdzić.</span></button></div>` : ''}</div>`;
}

const foodRow = (kind: 'product' | 'recipe', id: string, meal?: Meal): string => {
  const f = food(kind, id); if (!f) return '';
  return `<button class="li" data-a="item" data-kind="${kind}" data-id="${id}"${meal ? ` data-meal="${meal}"` : ''}><span><span class="nm">${esc(f.name)}</span><br><span class="sub">${kind === 'recipe' ? '<span class="tag">przepis</span> · ' : ''}${kc(f.per100.kcal)} kcal / 100 g${f.sub && kind === 'product' ? ' · ' + esc(f.sub) : ''}</span></span>${ico('chev')}</button>`;
};
function filtered(q: string): { products: string[]; recipes: string[] } {
  const s = q.trim().toLowerCase(); const hit = (t: string) => !s || t.toLowerCase().includes(s);
  return { products: liveProducts().filter(p => hit(`${p.name} ${p.brand ?? ''} ${p.ean ?? ''}`)).sort((a, b) => a.name.localeCompare(b.name, 'pl')).map(p => p.id), recipes: liveRecipes().filter(r => hit(r.name)).sort((a, b) => a.name.localeCompare(b.name, 'pl')).map(r => r.id) };
}
export function viewProducts(): string {
  const { products, recipes } = filtered(store.ui.q);
  const pend = store.pending.map(p => `<div class="li has-ib"><span><span class="nm">EAN ${esc(p.ean)}</span><br><span class="sub">zeskanowany bez internetu</span></span><button class="btn" data-a="retry" data-ean="${esc(p.ean)}">${ico('refresh')}Sprawdź</button><button class="ib" data-a="dropPending" data-ean="${esc(p.ean)}" aria-label="Usuń kod ${esc(p.ean)}">${ico('x')}</button></div>`).join('');
  return `${brandTop()}<div class="stack"><div class="pad"><h1 class="title" id="page-title">Produkty</h1>
    <div class="inp"><input id="q" data-f="q" type="search" inputmode="search" placeholder="Szukaj nazwy, marki albo kodu" value="${esc(store.ui.q)}" aria-label="Szukaj"></div>
    <div class="g2"><button class="btn" data-a="open" data-p="form">${ico('plus')}Nowy produkt</button><button class="btn" data-a="open" data-p="recipe">${ico('plus')}Nowy przepis</button></div></div>
    ${pend ? `<div class="pad"><div class="cap">Do uzupełnienia</div><div class="card list">${pend}</div></div>` : ''}
    <div class="pad"><div class="cap">Przepisy</div><div class="card list" data-live="rlist">${recipes.map(id => foodRow('recipe', id)).join('') || '<div class="empty">Brak przepisów. Przepis liczy makro na 100 g gotowego dania.</div>'}</div></div>
    <div class="pad"><div class="cap" data-live="pcount">Produkty · ${products.length}</div><div class="card list" id="plist" data-live="plist">${products.map(id => foodRow('product', id)).join('') || '<div class="empty">Brak produktów. Zeskanuj kod albo dodaj produkt z etykiety.</div>'}</div></div></div>`;
}

export function viewProgress(): string {
  const d = localDate(); const ws = [...store.weights].sort((a, b) => a.date.localeCompare(b.date));
  const a = avg7(ws, d), ch = weeklyChange(ws, d), today = ws.find(w => w.date === d); const tg = myTargets(); const k = avgKcal(store.entries, d);
  const last30 = ws.filter(w => w.date > addDays(d, -30));
  let chart = '';
  if (last30.length >= 2) {
    const xs = last30.map(w => w.kg), mn = Math.min(...xs) - 0.3, mx = Math.max(...xs) + 0.3; const W = 320, H = 96;
    const px = (date: string) => ((30 - (Date.parse(d) - Date.parse(date)) / 864e5) / 30) * W; const py = (kg: number) => H - 4 - ((kg - mn) / (mx - mn)) * (H - 8);
    const path = last30.map((w, i) => `${i ? 'L' : 'M'}${px(w.date).toFixed(1)} ${py(w.kg).toFixed(1)}`).join(' '); const lw = last30[last30.length - 1]!;
    chart = `<figure class="chart" style="margin:0"><svg viewBox="-6 -6 ${W + 12} ${H + 12}" role="img" aria-label="Waga z 30 dni, od ${n1(last30[0]!.kg)} do ${n1(lw.kg)} kg"><path d="${path}" fill="none" stroke="var(--text)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>${last30.map(w => `<circle cx="${px(w.date).toFixed(1)}" cy="${py(w.kg).toFixed(1)}" r="2.5" fill="var(--muted)"/>`).join('')}<circle cx="${px(lw.date).toFixed(1)}" cy="${py(lw.kg).toFixed(1)}" r="4.5" fill="var(--accent)"/></svg><figcaption class="row meta" style="justify-content:space-between"><span>30 dni temu</span><span>dziś</span></figcaption></figure>`;
  }
  return `${brandTop()}<div class="stack"><div class="pad"><h1 class="title" id="page-title">Postęp</h1>
    <div class="meta">Średnia wagi z 7 dni</div>
    <div class="row" style="align-items:baseline;gap:var(--s3)"><span class="hero" id="avg7">${a == null ? '—' : n1(a) + ' kg'}</span>${ch == null ? '' : `<span class="meta">${ch > 0 ? '+' : ch < 0 ? '−' : '±'}${n1(Math.abs(ch))} kg w tydzień</span>`}</div>
    ${chart || '<div class="empty">Wykres pojawi się po dwóch pomiarach. Waż się rano, po toalecie, przed jedzeniem: średnia z 7 dni wygładza wodę.</div>'}
    <div class="row" style="gap:var(--tap-gap);align-items:flex-end"><div class="grow">${field('kg', today ? 'Waga dziś (zmień)' : 'Waga dziś', store.ui.draft.kg ?? (today ? String(today.kg).replace('.', ',') : ''), 'kg', { ph: '0,0' })}</div><button class="btn pri" data-a="saveWeight">Zapisz</button></div>
    ${store.ui.err === 'kg' ? '<div class="err" role="alert">Wpisz wagę od 30 do 300 kg.</div>' : ''}</div>
    <div class="pad"><div class="card list">
      <div class="li"><span>Średnio kcal z ${k.days} ${k.days === 1 ? 'dnia' : 'dni'} z wpisami (7 dni)</span><span class="b">${k.days ? kc(k.avg) : '—'}</span></div>
      <div class="li"><span>Cel na dzień</span><span class="b">${kc(tg.kcal)}</span></div>
      <div class="li"><span>Pomiary wagi</span><span class="b">${ws.length}</span></div></div></div>
    ${ws.length ? `<div class="pad"><div class="cap">Ostatnie pomiary</div><div class="card list">${ws.slice(-7).reverse().map(w => `<div class="li has-ib"><span>${esc(fmtDay(w.date))}</span><span class="b">${n1(w.kg)} kg</span><button class="ib" data-a="delWeight" data-d="${w.date}" aria-label="Usuń pomiar z ${esc(w.date)}">${ico('trash')}</button></div>`).join('')}</div></div>` : ''}</div>`;
}

export function viewMore(): string {
  const th = store.settings.theme;
  const row = (p: string, t: string, s: string) => `<button class="li" data-a="open" data-p="${p}"><span><span class="nm">${t}</span><br><span class="sub">${s}</span></span>${ico('chev')}</button>`;
  return `${brandTop()}<div class="stack"><div class="pad"><h1 class="title" id="page-title">Więcej</h1>
    <div class="card list">${row('profile', 'Profil i cele', 'waga, wzrost, aktywność, kalorie i makro')}${row('backup', 'Kopia zapasowa', 'plik JSON z wszystkimi danymi')}${row('about', 'O aplikacji', `wersja ${VERSION}, źródło danych, prywatność`)}</div>
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
  return `${backTop('Dodaj do ' + MEAL_TO[meal])}<div class="scroll pscroll"><div class="stack"><div class="pad">
    <button class="btn pri block" data-a="scan" data-meal="${meal}">${ico('scan')}Skanuj kod</button>
    <div class="g2"><button class="btn" data-a="open" data-p="code" data-meal="${meal}">Wpisz kod</button><button class="btn" data-a="open" data-p="form" data-meal="${meal}">Z etykiety</button></div>
    <div class="inp"><input id="q" data-f="q" type="search" inputmode="search" placeholder="Szukaj w moich produktach" value="${esc(store.ui.q)}" aria-label="Szukaj"></div>
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
    <div class="g2">${field('grams', 'Ile', gStr, 'g', { invalid: !ok })}<div class="fld"><label for="meal">Posiłek</label><div class="inp"><select id="meal" data-f="meal">${MEALS.map(x => `<option value="${x}" ${x === p.meal ? 'selected' : ''}>${MEAL_NAME[x]}</option>`).join('')}</select></div></div></div>
    <div data-live="gerr">${!ok ? '<div class="err" role="alert">Wpisz ilość od 1 do 5000 g.</div>' : ''}</div>
    ${chips.length ? `<div class="chips" data-live="gchips">${chips.map(([v, l]) => `<button class="chip" data-a="grams" data-v="${v}" aria-pressed="${ok && Math.abs(g - v) < 0.01}">${esc(l)}</button>`).join('')}</div>` : ''}
    <div class="card" data-live="gcard"><div class="row" style="align-items:baseline;gap:var(--s2)"><span class="hero" id="pkcal">${kc(m.kcal)}</span><span class="mu">kcal w ${ok ? n1(g) : 0} g</span></div>
      <div class="tbl"><span class="cap">Składnik</span><span class="cap">${ok ? n1(g) : 0} g</span><span class="cap">100 g</span>
        ${([['Białko', 'p'], ['Tłuszcze', 'f'], ['Węglowodany', 'c']] as [string, keyof Per100][]).map(([l, k]) => `<span>${l}</span><span class="b">${n1(m[k] ?? 0)} g</span><span class="mu">${n1(f.per100[k] ?? 0)} g</span>`).join('')}</div></div>
    ${showCheck ? `<div class="note warn"><span class="b">Porównaj z etykietą</span><span>Dane z Open Food Facts bywają z błędami albo niepełne. Jeśli coś się nie zgadza, popraw produkt. Twoja wersja zostaje w telefonie.</span><button class="btn" data-a="open" data-p="form" data-id="${p.id}" data-meal="${p.meal}">${ico('edit')}Popraw wartości</button></div>` : ''}
    <button class="btn pri block" data-live="gbtn" data-a="${editing ? 'saveEntry' : 'addEntry'}" ${ok ? '' : 'disabled'}>${editing ? 'Zapisz zmianę' : 'Dodaj do ' + MEAL_TO[(store.ui.draft.meal as Meal) || p.meal]}</button>
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
    <div class="card"><div class="b">Skąd są dane produktów</div><div class="meta">Po zeskanowaniu kodu aplikacja pyta Open Food Facts (openfoodfacts.org), otwartą bazę produktów tworzoną przez użytkowników. Dane są na licencji Open Database License (ODbL). Mogą mieć błędy: porównaj je z etykietą przy pierwszym skanie.</div></div>
    <div class="card"><div class="b">Prywatność</div><div class="meta">Do Open Food Facts wysyłany jest tylko numer kodu kreskowego. Dziennik, waga i cele zostają w telefonie. Nie ma konta ani serwera. Skaner rozpoznaje kod w telefonie.</div></div>
    <div class="card"><div class="b">Ważne</div><div class="meta">Cele i przeliczenia to szacunki, nie porada medyczna.</div></div></div></div></div>`;
}
export function pageHtml(): string {
  const p = page(); if (!p) return '';
  switch (p.t) {
    case 'add': return pageAdd(p.meal); case 'item': return pageItem(p); case 'form': return pageForm(p); case 'code': return pageCode(p.meal);
    case 'recipe': return pageRecipe(); case 'pickIng': return pagePickIng(); case 'profile': return pageProfile(!!p.first); case 'backup': return pageBackup(); case 'about': return pageAbout();
  }
}
export { mark };
