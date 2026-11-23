import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { openDb, put, putMeta } from '../../src/storage/db';
import { exportBackup, restoreBackup, validateBackup } from '../../src/storage/backup';

describe('backup', () => {
  it('export, then restore into an empty database, gives the same data', async () => {
    const a = await openDb(indexedDB);
    await put(a, 'products', { id: 'p1', name: 'Twaróg', ean: '5900820000134', per100: { kcal: 133, p: 18, f: 4, c: 3.5 }, source: 'user', createdAt: 1, updatedAt: 1 });
    await put(a, 'entries', { id: 'e1', date: '2026-11-23', meal: 'breakfast', productId: 'p1', name: 'Twaróg', grams: 100, per100: { kcal: 133, p: 18, f: 4, c: 3.5 }, at: 2 });
    await put(a, 'weights', { date: '2026-11-23', kg: 80.4 });
    await putMeta(a, 'profile', { sex: 'm', birthYear: 1990, heightCm: 180, weightKg: 80.4, activity: 3, goal: 'cut', proteinPerKg: 1.8 });
    const data = await exportBackup(a); a.close();
    const text = JSON.stringify(data);
    const c = validateBackup(text); expect(c.ok).toBe(true); if (!c.ok) return;
    expect(c.counts).toEqual({ products: 1, entries: 1, recipes: 0, weights: 1 });
    indexedDB.deleteDatabase('fuelsmith');
    const b = await openDb(indexedDB); await restoreBackup(b, c.data);
    const again = await exportBackup(b);
    expect({ ...again, exportedAt: 0 }).toEqual({ ...data, exportedAt: 0 });
  });
  it('refuses a sibling app, a broken file and a newer schema', () => {
    expect(validateBackup('{"app":"flexsmith","schema":1}')).toEqual({ ok: false, reason: 'app' });
    expect(validateBackup('not json')).toEqual({ ok: false, reason: 'json' });
    expect(validateBackup('{"app":"fuelsmith","schema":99,"products":[],"entries":[],"recipes":[],"weights":[]}')).toEqual({ ok: false, reason: 'schema' });
    expect(validateBackup('{"app":"fuelsmith","schema":1,"products":[],"entries":[{"id":"x"}],"recipes":[],"weights":[]}')).toEqual({ ok: false, reason: 'shape' });
  });
});
