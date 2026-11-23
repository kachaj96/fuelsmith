/* UI/UX audit: measures the screen that is open now. Paste into the browser console, then run:
     uiAudit({ accent: '#56692A', tap: 48 })
   or let run-audit.mjs inject it. Returns plain JSON. It measures, it does not judge taste: read the result with SKILL.md. */
(function (root) {
  function uiAudit(opts) {
    const o = Object.assign({
      accent: null,            // '#RRGGBB' or a CSS custom property name ('--accent'); null = guess from buttons
      tap: 48,                 // minimum touch target (48 Android, 44 iOS, 24 the WCAG floor)
      tapGap: 8,               // minimum gap between two small targets
      minText: 13,             // smallest normal text
      captionText: 11,         // allowed only for caps labels and icon captions
      scale: [11, 13, 16, 19, 23, 28, 33, 40, 48], // allowed type sizes (16 x 1.2, rounded)
      spacingBase: 4,
      maxAccent: 3,
      ignore: '',              // selector of elements to skip (e.g. a debug panel)
      softTarget: '.chip',     // selector of controls with a smaller face and an invisible larger hit area
    }, opts || {});
    const out = { url: location.href, viewport: { w: innerWidth, h: innerHeight }, problems: {} };
    const skip = e => (o.ignore && e.closest(o.ignore)) || e.closest('script,style,head,noscript,template');
    const vis = e => { const r = e.getBoundingClientRect(); if (r.width < 1 || r.height < 1) return false; const cs = getComputedStyle(e); return cs.visibility !== 'hidden' && cs.display !== 'none' && +cs.opacity > 0.01; };
    const all = [...document.body.querySelectorAll('*')].filter(e => !skip(e));
    const shown = all.filter(vis);
    const desc = e => { let s = e.tagName.toLowerCase(); if (e.id) s += '#' + e.id; if (typeof e.className === 'string' && e.className.trim()) s += '.' + e.className.trim().split(/\s+/).slice(0, 2).join('.'); const tx = (e.innerText || e.getAttribute('aria-label') || '').trim().replace(/\s+/g, ' ').slice(0, 32); return tx ? `${s} "${tx}"` : s; };
    const ownText = e => [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    const inView = r => r.bottom > 0 && r.top < innerHeight && r.right > 0 && r.left < innerWidth;

    /* colours */
    const probe = document.createElement('i'); document.body.appendChild(probe);
    const toRgb = c => { probe.style.color = ''; probe.style.color = c; return getComputedStyle(probe).color; };
    const parse = c => { const m = (c || '').match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[\s,/]+/).filter(Boolean).map(Number); return { r: p[0], g: p[1], b: p[2], a: p[3] == null ? 1 : p[3] }; };
    const lum = ({ r, g, b }) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
    const ratio = (a, b) => { const x = lum(a), y = lum(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
    const blend = (top, under) => ({ r: top.r * top.a + under.r * (1 - top.a), g: top.g * top.a + under.g * (1 - top.a), b: top.b * top.a + under.b * (1 - top.a), a: 1 });
    const bgOf = e => { const stack = []; for (let x = e; x; x = x.parentElement) { const c = parse(getComputedStyle(x).backgroundColor); if (c && c.a > 0) { stack.push(c); if (c.a >= 1) break; } } let base = { r: 255, g: 255, b: 255, a: 1 }; const html = parse(getComputedStyle(document.documentElement).backgroundColor); if (html && html.a > 0) base = html; for (let i = stack.length - 1; i >= 0; i--) base = blend(stack[i], base); return base; };
    const sat = c => { const mx = Math.max(c.r, c.g, c.b), mn = Math.min(c.r, c.g, c.b); return mx === 0 ? 0 : (mx - mn) / mx; };
    let accent = null;
    if (o.accent) accent = o.accent.startsWith('--') ? toRgb(`var(${o.accent})`) : toRgb(o.accent);
    if (!accent) { // guess: the most common saturated background on buttons
      const count = {}; for (const e of shown) if (e.matches('button,a,[role=button],input[type=submit]')) { const bg = getComputedStyle(e).backgroundColor, c = parse(bg); if (c && c.a > 0.9 && sat(c) > 0.3) count[bg] = (count[bg] || 0) + 1; }
      accent = Object.entries(count).sort((a, b) => b[1] - a[1])[0]?.[0] || null; out.accentGuessed = true;
    }
    out.accent = accent;

    /* 1. accent: elements painted in it, on screen, outside elements covered by a scrim */
    if (accent) {
      const hits = [];
      for (const e of shown) {
        const r = e.getBoundingClientRect(); if (!inView(r)) continue;
        const cs = getComputedStyle(e), b = getComputedStyle(e, '::before'), a = getComputedStyle(e, '::after');
        const why = [];
        if (cs.backgroundColor === accent) why.push('background');
        if (ownText(e) && cs.color === accent) why.push('text');
        if ((parseFloat(cs.borderTopWidth) >= 1.5 && cs.borderTopColor === accent) || (parseFloat(cs.outlineWidth) >= 1.5 && cs.outlineColor === accent && cs.outlineStyle !== 'none')) why.push('border');
        if (b.content !== 'none' && b.backgroundColor === accent) why.push('::before');
        if (a.content !== 'none' && a.backgroundColor === accent) why.push('::after');
        if (e instanceof SVGElement && (toRgb(cs.fill) === accent || toRgb(cs.stroke) === accent) && !e.closest('svg')?.parentElement?.closest('[data-accent-ok]')) why.push('svg');
        if (why.length && !(why.length === 1 && why[0] === 'svg' && hits.some(h => h.el.contains(e)))) hits.push({ el: e, why });
      }
      // one control counts once: drop hits inside another hit
      const top = hits.filter(h => !hits.some(x => x !== h && x.el.contains(h.el)));
      out.accentCount = top.length; out.accentElements = top.map(h => `${desc(h.el)} [${h.why.join('+')}]`);
      if (top.length > o.maxAccent) out.problems.accent = `${top.length} elements in the accent (max ${o.maxAccent})`;
    }

    /* 2. touch targets: size, overlaps, gaps */
    const ctlSel = 'a[href],button,input:not([type=hidden]),select,textarea,summary,[role=button],[role=tab],[role=link],[role=switch],[role=checkbox],[tabindex]:not([tabindex="-1"])';
    const ctls = shown.filter(e => e.matches(ctlSel) && !e.matches('label input[type=checkbox][style*="opacity: 0"]'));
    const inline = e => e.tagName === 'A' && e.closest('p,li,td') && getComputedStyle(e).display === 'inline';
    // the part of a control that can be seen: cut by every scrolling or clipping box around it (a chip scrolled under a sheet's footer is not under it)
    const clipped = e => { let r = e.getBoundingClientRect(); let L = r.left, T = r.top, R = r.right, B = r.bottom;
      for (let x = e.parentElement; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x); if (/(auto|scroll|hidden|clip)/.test(cs.overflowX + cs.overflowY)) { const c = x.getBoundingClientRect(); L = Math.max(L, c.left); T = Math.max(T, c.top); R = Math.min(R, c.right); B = Math.min(B, c.bottom); } }
      return { left: L, top: T, right: R, bottom: B, width: Math.max(0, R - L), height: Math.max(0, B - T) }; };
    const rects = ctls.map(e => ({ e, r: clipped(e), full: e.getBoundingClientRect(), soft: o.softTarget && e.matches(o.softTarget) })).filter(x => x.r.width > 0 && x.r.height > 0);
    out.targets = rects.length;
    out.smallTargets = rects.filter(x => !inline(x.e) && (x.full.width < o.tap - 0.5 || x.full.height < (x.soft ? o.tap - 8.5 : o.tap - 0.5))).map(x => `${desc(x.e)} ${Math.round(x.full.width)}x${Math.round(x.full.height)}`);   // size of the whole control, even when partly scrolled away
    out.inlineLinks = rects.filter(x => inline(x.e)).length;
    const ov = [], close = [];
    for (let i = 0; i < rects.length; i++) for (let j = i + 1; j < rects.length; j++) {
      const A = rects[i], B = rects[j]; if (A.e.contains(B.e) || B.e.contains(A.e)) continue;
      // a control under a fixed or sticky bar is a layer (it scrolls out from under it), not an overlap of hit areas
      const layer = e => { for (let x = e; x && x !== document.body; x = x.parentElement) { const cs = getComputedStyle(x), pos = cs.position; if (pos === 'fixed' || pos === 'sticky' || (pos === 'absolute' && cs.zIndex !== 'auto')) return x; } return null; };
      if (layer(A.e) !== layer(B.e)) continue;
      const dx = Math.max(0, Math.max(A.r.left, B.r.left) - Math.min(A.r.right, B.r.right)), dy = Math.max(0, Math.max(A.r.top, B.r.top) - Math.min(A.r.bottom, B.r.bottom));
      const overlap = A.r.left < B.r.right - 0.5 && B.r.left < A.r.right - 0.5 && A.r.top < B.r.bottom - 0.5 && B.r.top < A.r.bottom - 0.5;
      if (overlap) { const pa = document.elementFromPoint((A.r.left + A.r.right) / 2, (A.r.top + A.r.bottom) / 2); if (pa && (A.e.contains(pa) || B.e.contains(pa))) ov.push(`${desc(A.e)} / ${desc(B.e)}`); continue; }
      const small = Math.min(A.r.width, A.r.height) < o.tap * 1.5 && Math.min(B.r.width, B.r.height) < o.tap * 1.5;
      const gap = Math.max(dx, dy);
      if (small && gap > 0 && gap < o.tapGap - 0.5 && (dx === 0 || dy === 0)) close.push(`${desc(A.e)} / ${desc(B.e)}: ${Math.round(gap * 10) / 10} px`);
    }
    out.overlappingTargets = ov; out.targetsTooClose = close;
    if (out.smallTargets.length) out.problems.targets = `${out.smallTargets.length} controls under ${o.tap} px`;
    if (ov.length) out.problems.overlap = `${ov.length} overlapping hit areas`;
    if (close.length) out.problems.gap = `${close.length} pairs of small targets closer than ${o.tapGap} px`;

    /* 3. type */
    const texts = shown.filter(ownText);
    const sizes = {}, weights = {}, families = {}, offScale = new Set(), tooSmall = [], lh = [], track = [], nums = [];
    for (const e of texts) {
      const cs = getComputedStyle(e), fs = Math.round(parseFloat(cs.fontSize) * 10) / 10;
      sizes[fs] = (sizes[fs] || 0) + 1; weights[cs.fontWeight] = (weights[cs.fontWeight] || 0) + 1;
      const fam = cs.fontFamily.split(',')[0].trim().replace(/["']/g, ''); families[fam] = (families[fam] || 0) + 1;
      if (!o.scale.some(s => Math.abs(s - fs) < 0.6)) offScale.add(fs);
      const caps = cs.textTransform === 'uppercase';
      const caption = caps || !!e.closest('nav,[role=tablist],[role=navigation]') || (e.closest('button') && e.closest('button').querySelector('svg'));
      if (fs < o.minText - 0.1 && !(caption && fs >= o.captionText - 0.1)) tooSmall.push(`${desc(e)} ${fs}px`);
      const l = cs.lineHeight === 'normal' ? null : parseFloat(cs.lineHeight) / fs;
      if (l && e.innerText.trim().length > 60 && fs <= 18 && l < 1.4) lh.push(`${desc(e)} body ${l.toFixed(2)}`);
      if (l && fs >= 23 && l > 1.35) lh.push(`${desc(e)} heading ${l.toFixed(2)}`);
      const ls = cs.letterSpacing === 'normal' ? 0 : parseFloat(cs.letterSpacing) / fs;
      if (caps && fs <= 14 && ls < 0.03) track.push(`${desc(e)} caps label tracking ${ls.toFixed(3)}em (want ~0.06)`);
      if (fs >= 23 && ls > 0.005) track.push(`${desc(e)} large text tracking ${ls.toFixed(3)}em (want ~-0.02)`);
      if (caps && fs > 14) track.push(`${desc(e)} uppercase at ${fs}px (caps only for small labels)`);
      const t = e.innerText.trim(); if (/\d/.test(t) && t.replace(/[\d\s.,:×x/@%+\-–kgmh]/gi, '').length <= 2 && !/tabular-nums/.test(cs.fontVariantNumeric) && !/tnum/.test(cs.fontFeatureSettings)) nums.push(desc(e));
    }
    out.type = { sizes, weights, families, offScale: [...offScale].sort((a, b) => a - b) };
    out.textTooSmall = tooSmall; out.lineHeight = lh; out.tracking = track; out.numbersWithoutTabular = nums.slice(0, 20);
    out.fontLoaded = Object.fromEntries(Object.keys(families).filter(f => !/^(system-ui|sans-serif|serif|monospace|-apple-system|ui-)/i.test(f)).map(f => [f, document.fonts ? document.fonts.check(`16px "${f}"`) && [...document.fonts].some(ff => ff.family.replace(/["']/g, '') === f && ff.status === 'loaded') : null]));
    if (Object.keys(sizes).length > 6) out.problems.typeSizes = `${Object.keys(sizes).length} text sizes (aim for 4-5 from one scale)`;
    if (offScale.size) out.problems.offScale = `sizes off the scale: ${[...offScale].join(', ')}`;
    if (Object.keys(weights).length > 2) out.problems.weights = `${Object.keys(weights).length} font weights (one family, two weights)`;
    if (Object.keys(families).length > 1) out.problems.families = `${Object.keys(families).length} font families: ${Object.keys(families).join(', ')}`;
    if (tooSmall.length) out.problems.smallText = `${tooSmall.length} texts under ${o.minText} px`;
    if (Object.values(out.fontLoaded).some(v => v === false)) out.problems.fontNotLoaded = 'a declared font is not loaded (fallback in use)';

    /* 4. line length of paragraphs */
    out.longLines = texts.filter(e => e.innerText.length > 180).map(e => { const cs = getComputedStyle(e); const cpl = e.getBoundingClientRect().width / (parseFloat(cs.fontSize) * 0.5); return { e, cpl }; }).filter(x => x.cpl > 80).map(x => `${desc(x.e)} ~${Math.round(x.cpl)} chars per line`);

    /* 5. shape: radii, shadows, gradients, spacing grid */
    const radii = {}, shadows = {}, grads = [], offGrid = {};
    for (const e of shown) {
      const cs = getComputedStyle(e), r = e.getBoundingClientRect();
      const rad = parseFloat(cs.borderTopLeftRadius);
      if (rad > 0 && rad < Math.min(r.width, r.height) / 2 - 1) radii[Math.round(rad)] = (radii[Math.round(rad)] || 0) + 1;
      if (cs.boxShadow !== 'none') shadows[cs.boxShadow] = (shadows[cs.boxShadow] || 0) + 1;
      if (/gradient/.test(cs.backgroundImage)) grads.push(desc(e));
      for (const p of ['paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft', 'marginTop', 'marginBottom', 'rowGap', 'columnGap']) {
        const v = Math.abs(parseFloat(cs[p])); if (!v || v <= 2) continue;
        if (Math.abs(v / o.spacingBase - Math.round(v / o.spacingBase)) > 0.05) offGrid[Math.round(v * 10) / 10] = (offGrid[Math.round(v * 10) / 10] || 0) + 1;
      }
    }
    out.shape = { radii, shadowLevels: Object.keys(shadows).length, gradients: grads.slice(0, 10), spacingOffGrid: offGrid };
    if (Object.keys(radii).length > 3) out.problems.radii = `${Object.keys(radii).length} corner radii (aim for 2-3, outer = inner + padding)`;
    if (Object.keys(shadows).length > 2) out.problems.shadows = `${Object.keys(shadows).length} shadow styles (two levels)`;
    if (grads.length) out.problems.gradients = `${grads.length} gradients (check each one means something)`;
    if (Object.keys(offGrid).length) out.problems.spacing = `spacing off the ${o.spacingBase} px grid: ${Object.keys(offGrid).join(', ')}`;

    /* 6. contrast of visible text */
    const lowC = [];
    for (const e of texts) {
      const r = e.getBoundingClientRect(); if (!inView(r)) continue;
      const cs = getComputedStyle(e), fg = parse(cs.color); if (!fg) continue;
      const bg = bgOf(e), c = ratio(fg.a < 1 ? blend(fg, bg) : fg, bg), fs = parseFloat(cs.fontSize), bold = +cs.fontWeight >= 700;
      const need = fs >= 24 || (bold && fs >= 18.66) ? 3 : 4.5;
      if (c < need - 0.05) lowC.push(`${desc(e)} ${c.toFixed(2)}:1 (need ${need})`);
    }
    out.lowContrast = lowC.slice(0, 30);
    if (lowC.length) out.problems.contrast = `${lowC.length} texts under WCAG AA contrast (background images and overlays not counted)`;

    /* 7. layout faults */
    out.overflowX = document.documentElement.scrollWidth - innerWidth;
    if (out.overflowX > 0) out.problems.overflow = `page scrolls sideways by ${out.overflowX} px`;
    out.clippedLabels = shown.filter(e => ownText(e) && e.scrollWidth > e.clientWidth + 1 && /ellipsis|clip/.test(getComputedStyle(e).textOverflow + getComputedStyle(e).overflowX) && e.innerText.trim().split(/\s+/).length <= 3).map(e => `${desc(e)} (${e.scrollWidth}>${e.clientWidth})`);
    if (out.clippedLabels.length) out.problems.clipped = `${out.clippedLabels.length} short labels cut off`;
    out.hiddenButShown = all.filter(e => e.hasAttribute('hidden') && getComputedStyle(e).display !== 'none').map(desc);
    if (out.hiddenButShown.length) out.problems.hidden = `${out.hiddenButShown.length} elements with [hidden] still displayed (a display rule overrides it)`;
    out.primaryButtons = accent ? shown.filter(e => e.matches('button,a,[role=button]') && getComputedStyle(e).backgroundColor === accent && inView(e.getBoundingClientRect())).map(desc) : [];
    if (out.primaryButtons.length > 1) out.problems.primary = `${out.primaryButtons.length} accent-filled buttons on screen (one main action)`;
    probe.remove();
    out.problemCount = Object.keys(out.problems).length;
    return out;
  }
  root.uiAudit = uiAudit;
})(typeof window !== 'undefined' ? window : globalThis);
