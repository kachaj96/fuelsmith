// Fuelsmith brand geometry: the single source for every logo asset (design/, favicon, launcher icons, in-app mark, start screen).
// Approved direction: a raspberry tile with a white drop (fuel, water, food), the family tile: 1024 canvas, 22.4 % radius.
export const BRAND = {
  name: 'Fuelsmith',
  tile: '#A8325A',          // raspberry, the light-theme UI accent; white on it is 6.4:1
  radius: 229,              // 22.4 % of the tile, as in Runsmith, Repsmith and Flexsmith
  glyphColor: '#FFFFFF',
};
/** The drop: a pointed top, round body. Drawn with two cubic curves and one arc so it scales cleanly. */
const DROP = 'M512 176C590 300 748 452 748 628A236 236 0 0 1 276 628C276 452 434 300 512 176Z';
export const PARTS = [{ id: 'drop', kind: 'fill', d: DROP }];
/** Bounding box of the symbol on the tile (x0, y0, x1, y1). */
export const BBOX = [276, 176, 748, 864];
const mapW = w => w;
const mapPath = d => d;

export const partMarkup = (p, color = BRAND.glyphColor, extra = '') => `<path ${extra}fill="${color}" d="${p.d}"/>`;
export const glyphMarkup = (color = BRAND.glyphColor) => PARTS.map(p => partMarkup(p, color)).join('');

/** The glyph fitted into the adaptive-icon safe zone: its bounding circle gets the given diameter (fraction of the 108 dp canvas), centred. */
export function safeGlyph(color = BRAND.glyphColor, diameter = 0.6) {
  const w = BBOX[2] - BBOX[0], h = BBOX[3] - BBOX[1], diag = Math.hypot(w, h);
  const s = (1024 * diameter) / diag;
  const cx = (BBOX[0] + BBOX[2]) / 2, cy = (BBOX[1] + BBOX[3]) / 2;
  return `<g transform="translate(512 512) scale(${+s.toFixed(4)}) translate(${-+cx.toFixed(1)} ${-+cy.toFixed(1)})">${glyphMarkup(color)}</g>`;
}

const open = (extra = '') => `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024"${extra}>`;
export const svgs = {
  logo: () => `${open(' role="img" aria-label="Fuelsmith"')}<rect width="1024" height="1024" rx="${BRAND.radius}" fill="${BRAND.tile}"/>${glyphMarkup()}</svg>\n`,
  glyph: () => `${open()}${glyphMarkup()}</svg>\n`,
  mono: () => `${open()}${glyphMarkup('#000000')}</svg>\n`,
  mark: () => `${open()}${glyphMarkup(BRAND.tile)}</svg>\n`,
  foreground: () => `${open()}${safeGlyph()}</svg>\n`,
  monochrome: () => `${open()}${safeGlyph('#000000')}</svg>\n`,
  background: () => `${open()}<rect width="1024" height="1024" fill="${BRAND.tile}"/></svg>\n`,
  round: () => `${open()}<circle cx="512" cy="512" r="512" fill="${BRAND.tile}"/>${safeGlyph(BRAND.glyphColor, 0.62)}</svg>\n`,
  /** Web app maskable icon: a full-bleed tile, the symbol inside the safe area. */
  maskable: () => `${open()}<rect width="1024" height="1024" fill="${BRAND.tile}"/>${safeGlyph(BRAND.glyphColor, 0.72)}</svg>\n`,
};

/* ---- Start screen: the same timeline as Runsmith and Repsmith (docs/MOTION.md). Each part is revealed by a thick stroke drawn along its own
   shape: the drop fills from its tip down to the round body. ---- */
const REVEAL = {
  drop: [{ d: mapPath('M512 120L512 900'), w: mapW(520), delay: 300, dur: 700 }],
};
export const TIMELINE = { tile: 420, symbolStart: 300, symbolEnd: 1040, wordmark: [940, 300], holdUntil: 1600, fade: 260 };

export function splashSvg() {
  const masks = PARTS.map(p => `<mask id="sp-m-${p.id}" maskUnits="userSpaceOnUse" x="0" y="0" width="1024" height="1024">${REVEAL[p.id].map(v =>
    `<path class="sp-rv" pathLength="1" fill="none" stroke="#fff" stroke-width="${v.w}" style="--d:${v.delay}ms;--t:${v.dur}ms" d="${v.d}"/>`).join('')}</mask>`).join('');
  const body = PARTS.map(p => `<g mask="url(#sp-m-${p.id})">${partMarkup(p)}</g>`).join('');
  return `<svg class="sp-tile" viewBox="0 0 1024 1024" aria-hidden="true" focusable="false"><defs>${masks}</defs><rect width="1024" height="1024" rx="${BRAND.radius}" fill="${BRAND.tile}"/>${body}</svg>`;
}
