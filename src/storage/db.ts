
/* Local-first persistence. IndexedDB database "fuelsmith" (never a sibling's), localStorage keys only with the prefix "fuelsmith.". */
export const DB_NAME = 'fuelsmith';
export const DB_VERSION = 1;
export const STORES = ['meta', 'products', 'entries', 'recipes', 'weights', 'pending'] as const;
export type StoreName = (typeof STORES)[number];
export class StorageError extends Error { constructor(public code: 'open' | 'write' | 'read', msg: string) { super(msg); } }

export function openDb(factory: IDBFactory = indexedDB): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    let req: IDBOpenDBRequest;
    try { req = factory.open(DB_NAME, DB_VERSION); } catch (e) { reject(new StorageError('open', e instanceof Error ? e.message : String(e))); return; }
    req.onupgradeneeded = () => {
      const db = req.result;
      for (const [n, key] of [['meta', 'key'], ['products', 'id'], ['entries', 'id'], ['recipes', 'id'], ['weights', 'date'], ['pending', 'ean']] as const)
        if (!db.objectStoreNames.contains(n)) db.createObjectStore(n, { keyPath: key });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(new StorageError('open', req.error?.message ?? 'open failed'));
    req.onblocked = () => reject(new StorageError('open', 'database blocked by another tab'));
  });
}
const done = (tx: IDBTransaction): Promise<void> => new Promise((res, rej) => { tx.oncomplete = () => res(); tx.onerror = () => rej(new StorageError('write', tx.error?.message ?? 'write failed')); tx.onabort = () => rej(new StorageError('write', tx.error?.message ?? 'aborted')); });
const reqP = <T>(r: IDBRequest<T>): Promise<T> => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(new StorageError('read', r.error?.message ?? 'read failed')); });

export async function getAll<T>(db: IDBDatabase, store: StoreName): Promise<T[]> { return reqP<T[]>(db.transaction(store).objectStore(store).getAll()); }
export async function put(db: IDBDatabase, store: StoreName, value: unknown): Promise<void> { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(value); await done(tx); }
export async function del(db: IDBDatabase, store: StoreName, key: string): Promise<void> { const tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(key); await done(tx); }
export async function getOne<T>(db: IDBDatabase, store: StoreName, key: string): Promise<T | undefined> { return reqP<T | undefined>(db.transaction(store).objectStore(store).get(key)); }

export async function getMeta<T>(db: IDBDatabase, key: string, fallback: T): Promise<T> {
  const row = await getOne<{ key: string; value: T }>(db, 'meta', key); return row ? row.value : fallback;
}
export const putMeta = (db: IDBDatabase, key: string, value: unknown): Promise<void> => put(db, 'meta', { key, value });
/** The few values index.html needs before the first paint, mirrored to localStorage (best effort). */
export function mirrorTheme(theme: string): void { try { localStorage.setItem('fuelsmith.theme', theme); } catch { /* blocked storage: the system theme applies */ } }

/** Replace the contents of several stores in ONE transaction. If anything throws, the transaction aborts and nothing changes. */
export async function replaceStores(db: IDBDatabase, data: Partial<Record<StoreName, unknown[]>>): Promise<void> {
  const names = Object.keys(data) as StoreName[]; const tx = db.transaction(names, 'readwrite');
  const finished = done(tx);
  try { for (const n of names) { const st = tx.objectStore(n); st.clear(); for (const row of data[n]!) st.put(row); } }
  catch (e) { try { tx.abort(); } catch { /* already finished */ } await finished.catch(() => undefined); throw new StorageError('write', e instanceof Error ? e.message : String(e)); }
  await finished;
}
