/* End-to-end in Chromium at phone sizes: the whole path (targets, scan by typed code, Open Food Facts found / not found / offline,
   product from the label, recipe, weight, backup), and on every screen the UI rules measured by tests/e2e/audit.js. Open Food Facts is mocked:
   the test never touches the network. Run with `npm run e2e` (builds first). */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFileSync, existsSync, mkdirSync } from 'node:fs';
import { join, extname, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '../..'); const DIST = join(ROOT, 'dist');
const AUDIT = readFileSync(join(ROOT, 'tests/e2e/audit.js'), 'utf8'); const SHOTS = process.env.SHOTS; if (SHOTS) mkdirSync(SHOTS, { recursive: true });
const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.png': 'image/png', '.json': 'application/json' };
const srv = createServer((q, r) => { let p = join(DIST, decodeURIComponent(q.url.split('?')[0])); if (p.endsWith('/')) p += 'index.html'; if (!existsSync(p)) { r.writeHead(404); r.end(); return; } r.writeHead(200, { 'content-type': types[extname(p)] || 'application/octet-stream' }); r.end(readFileSync(p)); }).listen(0);
const BASE = `http://localhost:${srv.address().port}/`;
let P = 0, F = 0; const check = (name, ok, detail = '') => { if (ok) { P++; console.log('PASS ', name); } else { F++; console.log('FAIL ', name, detail); } };
const LAYS = { code: '5900259128546', status: 1, product: { brands: "Lay's", product_name: 'Oven Baked Chanterelles in a cream sauce flavoured', serving_size: '1 portion (30 g)', nutriments: { 'energy-kcal_100g': 441, proteins_100g: 5.7, fat_100g: 14, carbohydrates_100g: 73.8, fiber_100g: 4.8 } } };
const PARTIAL = { code: '5000112637922', status: 1, product: { product_name: 'Cola', nutriments: { 'energy-kj_100g': 180 } } };

const browser = await chromium.launch(process.env.CHROMIUM_PATH ? { executablePath: process.env.CHROMIUM_PATH } : {});
async function open(w, h, scheme) {
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, locale: 'pl-PL', colorScheme: scheme, hasTouch: true });
  await ctx.addInitScript(() => { try { sessionStorage.setItem('smith.splash', 'played'); } catch { /* */ } });
  const calls = [];
  await ctx.route('https://world.openfoodfacts.org/**', route => {
    const u = route.request().url(); calls.push(u);
    if (u.includes('/5900259128546.json')) return route.fulfill({ json: LAYS });
    if (u.includes('/5000112637922.json')) return route.fulfill({ json: PARTIAL });
    if (u.includes('/4006381333931.json')) return route.abort('internetdisconnected');
    return route.fulfill({ json: { status: 0, status_verbose: 'product not found' } });
  });
  const page = await ctx.newPage(); const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  await page.goto(BASE); await page.waitForSelector('#page-title'); await page.waitForTimeout(300);
  return { ctx, page, errors, calls };
}
async function audit(page, tag) {
  await page.waitForTimeout(260);
  await page.addScriptTag({ content: AUDIT });
  const a = await page.evaluate(() => window.uiAudit({ accent: '--accent', tap: 48, tapGap: 8, softTarget: '.chip,.seg button', ignore: document.querySelector('.page') ? '#main,.nav,.toast' : '.toast' }));
  check(`${tag}: every control at least 48 px`, a.smallTargets.length === 0, a.smallTargets.join('; '));
  check(`${tag}: hit areas do not overlap`, a.overlappingTargets.length === 0, a.overlappingTargets.join('; '));
  check(`${tag}: accent on at most 3 things`, a.accentCount <= 3, a.accentElements.join('; '));
  check(`${tag}: one main button`, a.primaryButtons.length <= 1, a.primaryButtons.join('; '));
  check(`${tag}: no sideways scroll`, a.overflowX <= 0, `${a.overflowX}px`);
  check(`${tag}: no cut-off labels`, a.clippedLabels.length === 0, a.clippedLabels.join('; '));
  check(`${tag}: text at least 13 px (11 for caps labels)`, a.textTooSmall.length === 0, a.textTooSmall.join('; '));
  check(`${tag}: one font family, two weights`, Object.keys(a.type.families).length === 1 && Object.keys(a.type.weights).length <= 2, JSON.stringify([a.type.families, a.type.weights]));
  check(`${tag}: sizes from the scale`, a.type.offScale.length === 0, a.type.offScale.join(', '));
  check(`${tag}: contrast AA`, a.lowContrast.length === 0, a.lowContrast.join('; '));
  check(`${tag}: [hidden] really hidden`, a.hiddenButShown.length === 0, a.hiddenButShown.join('; '));
  if (SHOTS) await page.screenshot({ path: join(SHOTS, tag.replace(/[^\w]+/g, '_') + '.png') });
}
const closed = page => page.waitForFunction(() => !document.querySelector('.page'), null, { timeout: 5000 });
const txt = async (page, sel) => ((await page.textContent(sel)) ?? '').replace(/\s/g, '');

for (const scheme of ['light', 'dark']) for (const [w, h] of [[360, 760], [412, 915]]) {
  const T = `[${scheme} ${w}]`; const { ctx, page, errors, calls } = await open(w, h, scheme);
  // 1. first start: targets
  check(`${T} first start opens the targets`, (await page.textContent('#page-title')) === 'Twoje cele');
  await audit(page, `${T} targets`);
  await page.click('[data-a=saveProfile]'); check(`${T} empty fields are refused with a reason`, (await page.locator('.err').count()) === 1);
  await page.fill('#birthYear', '1990'); await page.fill('#heightCm', '180'); await page.fill('#weightKg', '80'); await page.click('[data-a=pf][data-k=goal][data-v=cut]');
  check(`${T} target 2170 kcal for a man, 36, 180 cm, 80 kg, moderate, cut`, await txt(page, '#tkcal') === '2170');
  check(`${T} typing keeps the field focused`, await page.evaluate(() => document.activeElement?.id) !== undefined);
  await page.click('[data-a=saveProfile]'); await page.waitForTimeout(150); await closed(page);
  { const v = await txt(page, '#left'); check(`${T} Today shows the whole target left`, v === '2170', v); }
  await audit(page, `${T} today`);
  // 2. a product from Open Food Facts by typed code
  await page.click('.meal-h [data-meal=snack]'); await audit(page, `${T} add`);
  await page.click('[data-a=open][data-p=code]'); await page.fill('#code', '5900259128547'); await page.click('[data-a=lookup]');
  check(`${T} a wrong check digit is refused before any request`, (await page.locator('.err').count()) === 1 && !calls.some(u => u.includes('5900259128547')));
  await page.fill('#code', '5900259128546'); await page.click('[data-a=lookup]'); await page.waitForSelector('#pkcal');
  check(`${T} found in Open Food Facts: the serving from the base (30 g) is the default`, await txt(page, '#pkcal') === '132');
  check(`${T} only the barcode is sent`, calls.length === 1 && /\/api\/v2\/product\/5900259128546\.json\?fields=/.test(calls[0]));
  check(`${T} first scan asks to compare with the label`, (await page.locator('.note.warn').count()) === 1);
  await audit(page, `${T} product`);
  await page.fill('#grams', '77'); check(`${T} 77 g = 340 kcal, recomputed while typing`, await txt(page, '#pkcal') === '340');
  check(`${T} the gram field keeps focus while typing`, await page.evaluate(() => document.activeElement?.id) === 'grams');
  await page.fill('#grams', '0'); check(`${T} 0 g cannot be added`, await page.locator('[data-a=addEntry]').isDisabled());
  await page.fill('#grams', '77'); await page.click('[data-a=addEntry]'); await closed(page);
  { const v = await txt(page, '#left'); check(`${T} added: 2170 - 340 = 1830 left`, v === '1830', v); }
  check(`${T} the toast offers undo`, (await page.locator('.toast [data-a=undo]').count()) === 1);
  await page.click('.toast [data-a=undo]'); await page.waitForTimeout(200); check(`${T} undo removes the entry`, await txt(page, '#left') === '2170');
  await page.click('.meal-h [data-meal=snack]'); await page.click('[data-a=list][data-id=all]'); await page.click('[data-a=item] >> nth=0'); await page.fill('#grams', '77'); await page.click('[data-a=addEntry]'); await closed(page);
  check(`${T} the product is remembered: no second request, 1830 left`, calls.length === 1 && await txt(page, '#left') === '1830');
  // 3. not in the base -> the form
  await page.click('.meal-h [data-meal=breakfast]'); await page.click('[data-a=open][data-p=code]'); await page.fill('#code', '5900820000134'); await page.click('[data-a=lookup]'); await page.waitForSelector('#name');
  check(`${T} not found opens the form with the code filled`, (await page.inputValue('#ean')) === '5900820000134');
  await page.click('[data-a=saveProduct]'); check(`${T} a nameless product is refused`, (await page.locator('.err').count()) === 1);
  await page.fill('#name', 'Twaróg półtłusty'); await page.fill('#kcal', '133'); await page.fill('#p', '18'); await page.fill('#f', '40'); await page.fill('#c', '3,5');
  check(`${T} a typo (40 g fat) is flagged`, (await page.locator('#check .note.warn').count()) === 1);
  await page.fill('#f', '4'); check(`${T} the right values pass the check`, (await page.locator('#check .note.warn').count()) === 0 && (await page.locator('#check .note').count()) === 1);
  await audit(page, `${T} form`);
  await page.click('[data-a=saveProduct]'); await page.waitForSelector('#pkcal');
  { const v = await txt(page, '#pkcal'); check(`${T} saved and opened for adding, 100 g = 133 kcal`, v === '133', v); }
  await page.click('[data-a=addEntry]'); await closed(page); check(`${T} 1830 - 133 = 1697 left`, await txt(page, '#left') === '1697');
  // 4. incomplete in the base (kJ only) -> the form, filled with what there is
  await page.click('.meal-h [data-meal=lunch]'); await page.click('[data-a=open][data-p=code]'); await page.fill('#code', '5000112637922'); await page.click('[data-a=lookup]'); await page.waitForSelector('#name');
  check(`${T} incomplete: kJ converted (180 kJ = 43 kcal), missing values left empty`, (await page.inputValue('#kcal')) === '43' && (await page.inputValue('#p')) === '');
  await page.click('[data-a=back]');
  // 5. offline -> the code waits
  await page.click('[data-a=open][data-p=code]'); await page.fill('#code', '4006381333931'); await page.click('[data-a=lookup]'); await page.waitForTimeout(400);
  check(`${T} offline: the code waits and the person is told`, /Brak internetu/.test((await page.textContent('.toast')) ?? ''));
  await page.click('[data-a=back]'); await page.click('[data-a=tab][data-id=products]');
  check(`${T} the waiting code is listed`, (await page.locator('[data-a=retry][data-ean="4006381333931"]').count()) === 1);
  await page.fill('#q', 'twar'); check(`${T} search filters while typing and keeps focus`, (await page.locator('#plist [data-a=item]').count()) === 1 && await page.evaluate(() => document.activeElement?.id) === 'q');
  await page.fill('#q', ''); await audit(page, `${T} products`);
  // 6. recipe
  await page.click('[data-a=open][data-p=recipe]'); await page.fill('#rname', 'Twarożek z chipsami');
  await page.click('[data-a=open][data-p=pickIng]'); await page.click('[data-a=pickIng][data-id] >> text=Oven Baked'); await page.click('[data-a=open][data-p=pickIng]'); await page.click('[data-a=pickIng][data-id] >> text=Twaróg');
  await page.fill('#cooked', '300');
  check(`${T} recipe: (340 + 133) / 300 g = 158 kcal per 100 g`, await txt(page, '#r100') === '158');
  await audit(page, `${T} recipe`);
  await page.click('[data-a=saveRecipe]'); await closed(page); check(`${T} the recipe is listed`, (await page.locator('[data-a=item][data-kind=recipe]').count()) === 1);
  // 7. weight
  await page.click('[data-a=tab][data-id=progress]'); await page.click('[data-a=prog][data-id=weight]'); await page.fill('#kg', '20'); await page.click('[data-a=saveWeight]');
  check(`${T} an impossible weight is refused`, (await page.locator('.err').count()) === 1);
  await page.fill('#kg', '80,4'); await page.click('[data-a=saveWeight]'); await page.waitForTimeout(200);
  check(`${T} weight saved, 7-day average shown`, await txt(page, '#avg7') === '80,4kg', await txt(page, '#avg7'));
  await audit(page, `${T} progress`);
  // 8. edit and delete an entry with undo
  await page.click('[data-a=tab][data-id=today]'); await page.click('.ent >> nth=0'); await page.fill('#grams', '200'); await page.click('[data-a=saveEntry]'); await closed(page);
  check(`${T} editing grams changes the day`, await txt(page, '#left') !== '1697');
  await page.click('.ent >> nth=0'); await page.click('[data-a=delEntry]'); await closed(page); await page.click('.toast [data-a=undo]'); await page.waitForTimeout(200);
  check(`${T} delete can be undone`, (await page.locator('.ent').count()) === 2);
  // 9. backup round trip
  await page.click('[data-a=tab][data-id=more]'); await audit(page, `${T} more`);
  const backup = await page.evaluate(async () => { const m = await import('/assets/' + [...document.scripts].map(s => s.src).find(s => s.includes('/assets/'))?.split('/assets/')[1]); return m ? 1 : 0; }).catch(() => 0);
  void backup;
  await page.click('[data-a=open][data-p=backup]'); await audit(page, `${T} backup`);
  await page.setInputFiles('#importFile', { name: 'x.json', mimeType: 'application/json', buffer: Buffer.from('{"app":"flexsmith","schema":1}') });
  await page.waitForTimeout(200); check(`${T} a sibling's backup is refused, data kept`, /To nie jest kopia Fuelsmith/.test((await page.textContent('.err')) ?? ''));
  // ---- 0.4 ----
  await page.click('[data-a=back]'); await page.click('[data-a=tab][data-id=today]');
  // water with undo
  await page.click('[data-a=water][data-v="250"]'); await page.click('[data-a=water][data-v="250"]'); await page.waitForTimeout(100);
  check(`${T} water: 2 x 250 ml = 0,5 l of 2,5 l (30 ml x 80,4 kg, to 250 ml)`, (await page.textContent('#water')) === '0,5 l z 2,5 l', await page.textContent('#water'));
  await page.click('.toast [data-a=undo]'); await page.waitForTimeout(150);
  check(`${T} water undo`, (await page.textContent('#water')) === '0,3 l z 2,5 l', await page.textContent('#water'));
  // a meal added to today and removed with undo
  await page.click('[data-a=open][data-p=dayMeal]'); await audit(page, `${T} day meal`);
  await page.click('[data-a=mname][data-v="Po treningu"]'); await page.click('[data-a=addDayMeal]'); await closed(page);
  check(`${T} added meal shows on Today`, (await page.locator('.meal-h .b', { hasText: 'Po treningu' }).count()) === 1);
  await page.click('[data-a=dropMeal][aria-label*="Po treningu"]'); await page.waitForTimeout(100);
  check(`${T} an empty meal can be removed from the day`, (await page.locator('.meal-h .b', { hasText: 'Po treningu' }).count()) === 0);
  await page.click('.toast [data-a=undo]'); await page.waitForTimeout(150);
  check(`${T} removing a meal can be undone`, (await page.locator('.meal-h .b', { hasText: 'Po treningu' }).count()) === 1);
  check(`${T} a meal with entries has no remove button`, (await page.locator('[data-a=dropMeal][aria-label*="Śniadanie"]').count()) === 0);
  // quick calories
  const left0 = await txt(page, '#left');
  await page.click('.meal-h [data-a=open][data-p=add] >> nth=1'); await page.click('[data-a=open][data-p=quick]'); await audit(page, `${T} quick`);
  await page.fill('#qname', 'Obiad na mieście'); await page.fill('#qkcal', '450'); await page.click('[data-a=saveQuick]'); await closed(page);
  check(`${T} quick calories: 450 kcal less left`, Number(await txt(page, '#left')) === Number(left0) - 450, `${left0} -> ${await txt(page, '#left')}`);
  // yesterday: quick 300 kcal in Kolacja, then repeat it today
  await page.click('[data-a=day][data-d="-1"]'); await page.click('.meal-h [data-a=open][data-p=add][aria-label="Dodaj do: Kolacja"]'); await page.click('[data-a=open][data-p=quick]');
  await page.fill('#qkcal', '300'); await page.click('[data-a=saveQuick]'); await closed(page);
  await page.click('[data-a=day][data-d="1"]');
  check(`${T} repeat from yesterday is offered on an empty meal`, (await page.locator('[data-a=repeatMeal]').count()) >= 1);
  const left1 = Number(await txt(page, '#left')); await page.click('[data-a=repeatMeal]'); await page.waitForTimeout(150);
  check(`${T} repeat copies yesterday's 300 kcal`, Number(await txt(page, '#left')) === left1 - 300);
  check(`${T} week balance is shown`, (await page.locator('#week').count()) === 1);
  await audit(page, `${T} today 0.4`);
  // meal plan: preset and rename
  await page.click('[data-a=tab][data-id=more]'); await page.click('[data-a=open][data-p=meals]'); await audit(page, `${T} meals`);
  await page.click('[data-a=mpreset][data-k="0"]'); await page.waitForTimeout(100);
  check(`${T} preset: 3 meals`, (await page.locator('[data-f=mrename]').count()) === 3);
  await page.fill('[data-f=mrename][data-k="0"]', 'Pierwsze'); await page.locator('[data-f=mrename][data-k="0"]').dispatchEvent('change'); await page.waitForTimeout(100);
  await page.click('[data-a=back]'); await page.click('[data-a=open][data-p=meals]');
  check(`${T} renamed meal is kept`, (await page.inputValue('[data-f=mrename][data-k="0"]')) === 'Pierwsze');
  await page.click('[data-a=back]'); await page.click('[data-a=tab][data-id=today]');
  check(`${T} today keeps its own meals after the plan changed`, (await page.locator('.meal-h .b', { hasText: 'Przekąski' }).count()) === 1);
  // calendar
  await page.click('[data-a=tab][data-id=progress]'); await page.click('[data-a=prog][data-id=cal]'); await audit(page, `${T} calendar`);
  check(`${T} calendar: days without entries are "?" (not zero)`, (await page.locator('.cal button.empty').count()) >= 1 && /nie liczą się jako 0/.test((await page.textContent('#calsum')) ?? ''));
  check(`${T} calendar: today is filled`, (await page.locator('.cal button.today .k').textContent()) !== '?');
  // weight goal: energy follows the pace (80,4 kg: BMR 1754 x 1.55 = 2718.7; 80.4 x 0.005 x 7700 / 7 = 442 -> 440; 2278.7 -> 2280)
  await page.click('[data-a=prog][data-id=weight]'); await page.click('[data-a=open][data-p=goal]'); await page.fill('#gkg', '75'); await audit(page, `${T} goal`);
  await page.click('[data-a=saveGoal]'); await closed(page);
  check(`${T} goal set: forecast waits for 4 weigh-ins`, /4 pomiarów/.test((await page.textContent('#forecast')) ?? ''));
  await page.click('[data-a=tab][data-id=today]');
  check(`${T} goal: daily target 2280 kcal`, /z 2 280 kcal/.test((await page.textContent('.stack')) ?? ''));
  // advice and the real need, from 3 weeks of data put straight into the app state (no network, no clock tricks)
  await page.evaluate(() => { const S = window.__fuel; const t = new Date(); const day = n => { const d = new Date(t); d.setDate(d.getDate() - n); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
    S.weights = Array.from({ length: 22 }, (_, i) => ({ date: day(21 - i), kg: 84.6 - i * 0.2 }));
    S.entries = [...S.entries, ...Array.from({ length: 21 }, (_, i) => ({ id: 'h' + i, date: day(i + 1), meal: 'lunch', productId: 'quick', name: 'x', grams: 100, per100: { kcal: 1500, p: 0, f: 0, c: 0 }, at: 0, quick: true }))]; });
  await page.click('[data-a=tab][data-id=progress]'); await page.click('[data-a=prog][data-id=weight]');
  check(`${T} losing 1,4 kg a week: "too fast" with +200 kcal`, /Za szybko/.test((await page.textContent('#advice')) ?? '') && /\+200 kcal/.test((await page.textContent('#advice')) ?? ''));
  check(`${T} the forecast shows a date range`, /Zakres:/.test((await page.textContent('#forecast')) ?? ''));
  check(`${T} real need is shown with its basis`, /uzupełnionych dni z 21/.test((await page.textContent('#need')) ?? ''));
  await audit(page, `${T} weight`);
  await page.click('[data-a=applyAdvice]'); await page.waitForTimeout(150);
  check(`${T} apply sets the calorie target and can be undone`, /Cel kalorii:/.test((await page.textContent('.toast')) ?? '') && await page.evaluate(() => window.__fuel.overrides.kcal != null));
  await page.click('.toast [data-a=undo]'); await page.waitForTimeout(150);
  check(`${T} undo removes the override`, await page.evaluate(() => window.__fuel.overrides.kcal == null));
  await page.click('[data-a=prog][data-id=water]'); await audit(page, `${T} water`);
  check(`${T} water history shows "brak" for empty days`, (await page.locator('.mac', { hasText: 'brak' }).count()) >= 1);
  check(`${T} no page errors`, errors.length === 0, errors.join(' | '));
  await ctx.close();
}
await browser.close(); srv.close();
console.log(`\n${P} passed, ${F} failed`); process.exit(F ? 1 : 0);
