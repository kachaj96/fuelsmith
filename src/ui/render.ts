import { navHtml, pageHtml, TAB_VIEWS, esc } from './views';
import { page, store } from './state';

export function applyTheme(): void {
  const th = store.settings.theme; const dark = th === 'dark' || (th === 'system' && matchMedia('(prefers-color-scheme: dark)').matches);
  document.documentElement.dataset.smithTheme = dark ? 'dark' : 'light';
}
/** Copies the regions marked data-live from a fresh render into the screen, so the field being typed in keeps focus and the keyboard. */
function patch(oldRoot: HTMLElement, html: string): void {
  const tmp = document.createElement('div'); tmp.innerHTML = html;
  tmp.querySelectorAll<HTMLElement>('[data-live]').forEach(n => { const o = oldRoot.querySelector<HTMLElement>(`[data-live="${n.dataset.live}"]`); if (o && o.outerHTML !== n.outerHTML) o.replaceWith(n); });
  // invalid state of fields follows the value
  tmp.querySelectorAll<HTMLElement>('.inp').forEach(n => { const id = n.querySelector('input,select')?.id; const o = id ? oldRoot.querySelector<HTMLElement>(`#${CSS.escape(id)}`)?.closest('.inp') : null; if (o) { if (n.hasAttribute('aria-invalid')) o.setAttribute('aria-invalid', 'true'); else o.removeAttribute('aria-invalid'); } });
}
export function render(keepScroll = true): void {
  applyTheme();
  const root = store.root; const old = root.querySelector<HTMLElement>('#main'); const y = keepScroll && old ? old.scrollTop : 0;
  root.querySelectorAll('#main,.nav').forEach(n => n.remove());
  const main = document.createElement('div'); main.className = 'scroll'; main.id = 'main'; main.innerHTML = TAB_VIEWS[store.ui.tab]!();
  root.prepend(main); root.insertAdjacentHTML('beforeend', navHtml()); main.scrollTop = y;
  renderPage();
}
let shownKey = '';
const key = (): string => { const p = page(); return p ? `${store.ui.stack.length}:${p.t}:${'id' in p ? p.id ?? '' : ''}:${'entryId' in p ? p.entryId ?? '' : ''}` : ''; };
/** Draws the page on top (if any) and the toast. soft = only the live regions (typing). A redraw of the same page keeps its scroll and does not replay the entrance. */
export function renderPage(soft = false): void {
  const root = store.root; const p = page();
  if (soft) {
    if (p) { const el = root.querySelector<HTMLElement>('.page'); if (el) { patch(el, pageHtml()); return; } }
    else { const m = root.querySelector<HTMLElement>('#main'); if (m) { patch(m, TAB_VIEWS[store.ui.tab]!()); return; } }
  }
  const oldPage = root.querySelector<HTMLElement>('.page'); const y = oldPage?.querySelector<HTMLElement>('.scroll')?.scrollTop ?? 0;
  root.querySelectorAll('.page,.toast').forEach(n => n.remove());
  const k = key();
  if (p) {
    const el = document.createElement('div'); el.className = k === shownKey && oldPage ? 'page still' : 'page'; el.setAttribute('role', 'region'); el.setAttribute('aria-label', 'Strona');
    el.innerHTML = pageHtml(); root.append(el);
    const sc = el.querySelector<HTMLElement>('.scroll'); if (sc && k === shownKey) sc.scrollTop = y;
    if (k !== shownKey) (el.querySelector('#page-title') as HTMLElement | null)?.setAttribute('tabindex', '-1');
  }
  shownKey = k;
  const tt = store.ui.toast;
  if (tt) { const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.innerHTML = `<span class="grow">${esc(tt.msg)}</span>${tt.undo ? '<button data-a="undo">Cofnij</button>' : ''}`; root.append(el); }
}
let timer = 0;
export function toast(msg: string, undo?: () => void): void {
  store.ui.toast = { msg, ...(undo ? { undo } : {}) };
  store.root.querySelectorAll('.toast').forEach(n => n.remove());
  const el = document.createElement('div'); el.className = 'toast'; el.setAttribute('role', 'status'); el.innerHTML = `<span class="grow">${esc(msg)}</span>${undo ? '<button data-a="undo">Cofnij</button>' : ''}`; store.root.append(el);
  clearTimeout(timer); timer = window.setTimeout(() => { store.ui.toast = null; store.root.querySelector('.toast')?.remove(); }, undo ? 5000 : 3500);
}
