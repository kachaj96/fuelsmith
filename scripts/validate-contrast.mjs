#!/usr/bin/env node
// Contrast gate for src/styles/tokens.css: WCAG ratios from the real values in both themes. Text 4.5:1, graphics 3:1.
import { readFileSync } from 'node:fs';
const css = readFileSync(new URL('../src/styles/tokens.css', import.meta.url), 'utf8');
const vars = text => Object.fromEntries([...text.matchAll(/--([\w-]+):\s*(#[0-9a-fA-F]{3,6})\b/g)].map(m => [m[1], m[2]]));
const light = vars(css.slice(css.indexOf(':root {'), css.indexOf('}', css.indexOf(':root {'))));
const di = css.indexOf(':root[data-smith-theme="dark"]'); const dark = { ...light, ...vars(css.slice(di, css.indexOf('}', di))) };
const lin = c => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const rgb = h => { h = h.replace('#', ''); if (h.length === 3) h = [...h].map(x => x + x).join(''); return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16)); };
const L = h => { const [r, g, b] = rgb(h); return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b); };
const ratio = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const PAIRS = [['text', 'bg', 4.5], ['text', 'surface', 4.5], ['text', 'field', 4.5], ['muted', 'bg', 4.5], ['muted', 'surface', 4.5], ['muted', 'field', 4.5],
  ['on-accent', 'accent', 4.5], ['accent', 'bg', 3], ['accent', 'surface', 3], ['warn', 'bg', 4.5], ['warn', 'surface', 4.5], ['warn', 'field', 3], ['error', 'bg', 4.5], ['error', 'surface', 4.5], ['bg', 'text', 4.5]];
let bad = 0, n = 0;
for (const [name, t] of [['light', light], ['dark', dark]]) for (const [f, b, min] of PAIRS) {
  n++; if (!t[f] || !t[b]) { console.log(`FAIL [${name}] missing --${f} or --${b}`); bad++; continue; }
  const r = ratio(t[f], t[b]); if (r < min) { console.log(`FAIL [${name}] ${f} on ${b}: ${r.toFixed(2)} < ${min}`); bad++; } else if (process.argv.includes('-v')) console.log(`ok   [${name}] ${f} on ${b}: ${r.toFixed(2)}`);
}
if (ratio('#ffffff', '#A8325A') < 3) { console.log('FAIL logo tile with the white drop'); bad++; } n++;
console.log(bad ? `${bad} contrast failure(s) of ${n}` : `contrast ok: ${n} pairs`); process.exit(bad ? 1 : 0);
