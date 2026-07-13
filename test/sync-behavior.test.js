/**
 * Tests for invisible sync bugs:
 * 1) HTTP/API errors were treated as successful sync
 * 2) load() silently overwrote user-edited name/sub/unit from DEFAULT_ITEMS
 */
const assert = require('assert');
const {
  isInventoryPayload,
  syncFailureMessage,
  mergeLoadedItem,
  buildExportPayload,
} = require('../lib/sync-behavior');

function test(name, fn) {
  try {
    fn();
    console.log('ok -', name);
  } catch (e) {
    console.error('FAIL -', name);
    console.error(e.message);
    process.exitCode = 1;
  }
}

test('isInventoryPayload rejects API error objects', () => {
  assert.strictEqual(isInventoryPayload({ error: 'Neon 数据库运行报错: boom' }), false);
});

test('isInventoryPayload rejects null / non-objects', () => {
  assert.strictEqual(isInventoryPayload(null), false);
  assert.strictEqual(isInventoryPayload('{"items":[]}'), false);
});

test('isInventoryPayload accepts inventory state', () => {
  assert.strictEqual(isInventoryPayload({ items: [{ id: 'a', qty: 1 }] }), true);
});

test('syncFailureMessage surfaces HTTP and body errors', () => {
  assert.match(
    syncFailureMessage({ ok: false, status: 500 }, { error: 'missing POSTGRES_URL' }),
    /POSTGRES_URL|500/
  );
  assert.match(syncFailureMessage({ ok: false, status: 500 }, null), /500/);
  assert.strictEqual(syncFailureMessage({ ok: true, status: 200 }, { items: [] }), null);
});

test('mergeLoadedItem preserves user-edited name, sub, and unit', () => {
  const defaults = [
    { id: 'boot_39', name: '安全靴 Boot Size 39', sub: '', unit: 'pairs', cat: 'safety' },
  ];
  const saved = {
    id: 'boot_39',
    name: '安全靴 EDITED',
    sub: 'warehouse A',
    unit: 'pcs',
    qty: 10,
    low: 3,
    icon: '🥾',
    cat: 'safety',
  };
  const merged = mergeLoadedItem(saved, defaults);
  assert.strictEqual(merged.name, '安全靴 EDITED');
  assert.strictEqual(merged.sub, 'warehouse A');
  assert.strictEqual(merged.unit, 'pcs');
  assert.strictEqual(merged.qty, 10);
});

test('mergeLoadedItem fills missing fields from defaults only', () => {
  const defaults = [
    { id: 'boot_39', name: '安全靴 Boot Size 39', sub: 'default-sub', unit: 'pairs', icon: '🥾', cat: 'safety' },
  ];
  const sparse = { id: 'boot_39', qty: 2, low: 1 };
  const merged = mergeLoadedItem(sparse, defaults);
  assert.strictEqual(merged.name, '安全靴 Boot Size 39');
  assert.strictEqual(merged.unit, 'pairs');
  assert.strictEqual(merged.qty, 2);
});

test('buildExportPayload includes purchases so share code is not silently incomplete', () => {
  const state = {
    cats: [],
    items: [{ id: 'x' }],
    history: [{ id: 'h1' }],
    purchases: [{ id: 'p1', person: 'Ali', items: [], ts: 1 }],
    customIcons: ['✨'],
  };
  const payload = buildExportPayload(state, 123);
  assert.ok(Array.isArray(payload.purchases));
  assert.strictEqual(payload.purchases.length, 1);
  assert.strictEqual(payload.purchases[0].id, 'p1');
  assert.deepStrictEqual(payload.customIcons, ['✨']);
});

if (!process.exitCode) console.log('\nAll sync-behavior tests passed.');
