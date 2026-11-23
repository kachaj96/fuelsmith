import './styles/fonts.css';
import './styles/tokens.css';
import './styles/base.css';
import { startApp } from './app';
import { StorageError, openDb } from './storage/db';
import { startSplash } from './splash';
import { esc } from './ui/views';

function showFatal(root: HTMLElement, detail: string): void {
  root.innerHTML = `<div class="scroll"><div class="pad" style="padding-top:24px"><div class="note warn" role="alert"><b>Nie udało się otworzyć danych.</b><span>${esc(detail)}</span><button class="btn pri" id="retry" type="button">Spróbuj ponownie</button></div></div></div>`;
  document.getElementById('retry')?.addEventListener('click', () => location.reload());
}
async function boot(): Promise<void> {
  const splash = startSplash();
  const root = document.getElementById('app')!;
  try {
    let db: IDBDatabase;
    try { db = await openDb(); }
    catch (e) { showFatal(root, e instanceof StorageError ? `${e.code}: ${e.message}` : e instanceof Error ? e.message : String(e)); splash.settle('failed'); return; }
    await startApp(root, db);
    splash.settle('ready');
  } catch (e) {
    showFatal(root, e instanceof Error ? e.message : String(e));
    splash.settle('failed');
  }
}
void boot();
