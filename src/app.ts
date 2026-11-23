import type { Entry, Overrides, Product, Profile, Recipe, Weight } from './domain/nutrition';
import type { Pending } from './storage/backup';
import { getAll, getMeta } from './storage/db';
import { isNative } from './platform/files';
import { goBack, onChange, onClick, onInput, push } from './ui/actions';
import { applyTheme, render } from './ui/render';
import { initStore, store, type Settings } from './ui/state';

/** Loads everything, draws the first view and wires the events. Resolves when the first view is in the DOM. */
export async function startApp(root: HTMLElement, db: IDBDatabase): Promise<void> {
  const [products, entries, recipes, weights, pending, profile, overrides, settings] = await Promise.all([
    getAll<Product>(db, 'products'), getAll<Entry>(db, 'entries'), getAll<Recipe>(db, 'recipes'), getAll<Weight>(db, 'weights'), getAll<Pending>(db, 'pending'),
    getMeta<Profile | null>(db, 'profile', null), getMeta<Overrides>(db, 'overrides', {}), getMeta<Settings>(db, 'settings', { theme: 'system' })]);
  initStore({ db, root, products, entries, recipes, weights, pending, profile, overrides, settings });
  (window as unknown as { __fuel?: unknown }).__fuel = store;   // read by the e2e tests
  applyTheme(); render(false);
  if (!profile) push({ t: 'profile', first: true });
  root.addEventListener('click', onClick); root.addEventListener('input', onInput); root.addEventListener('change', onChange);
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (store.settings.theme === 'system') applyTheme(); });
  document.addEventListener('keydown', ev => { if (ev.key === 'Escape') goBack(); });
  if (isNative()) {
    const { App } = await import('@capacitor/app');
    void App.addListener('backButton', () => {
      if (goBack()) return;
      if (store.ui.tab !== 'today') { store.ui.tab = 'today'; render(false); return; }
      void App.exitApp();
    });
  }
}
