/**
 * Tests for invisible sync bugs:
 * 1) HTTP/API errors were treated as successful sync
 * 2) load() silently overwrote user-edited name/sub/unit from DEFAULT_ITEMS
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');
const lib = require('../lib/sync-behavior');
const {
  isInventoryPayload,
  syncFailureMessage,
  mergeLoadedItem,
  buildExportPayload,
  itemTotal,
  nextTotal,
  cleanCompany,
  withCompany,
} = lib;

// index.html ships its own copy of this module inside bootstrapSafety, because
// the safety dashboard runs from a blob URL and cannot load /lib/*.js.
function loadInlineMirror() {
  const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
  const start = html.indexOf('const fallbackLibs =');
  const end = html.indexOf("'ipt>';", start);
  assert.ok(start > 0 && end > start, 'fallbackLibs not found in index.html');
  const expression = html.slice(start + 'const fallbackLibs ='.length, end + "'ipt>'".length);
  const scriptHtml = new Function('session', 'return (' + expression + ');')({ role: 'admin' });
  const objectStart = scriptHtml.indexOf('window.InventorySync=');
  const objectEnd = scriptHtml.indexOf('window.InventoryDisplay=');
  const snippet = scriptHtml.slice(objectStart, objectEnd);
  const fakeWindow = {};
  new Function('window', snippet)(fakeWindow);
  return fakeWindow.InventorySync;
}

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

test('buildExportPayload carries the company list', () => {
  const payload = buildExportPayload({ cats: [], items: [], companies: ['Top Er Heng'] }, 1);
  assert.deepStrictEqual(payload.companies, ['Top Er Heng']);
});

test('itemTotal treats stock saved before totals existed as the starting total', () => {
  assert.strictEqual(itemTotal({ qty: 50 }), 50);
  assert.strictEqual(itemTotal({ qty: 50, total: null }), 50);
  assert.strictEqual(itemTotal({ qty: 50, total: 'oops' }), 50);
  assert.strictEqual(itemTotal({ qty: 40, total: 250 }), 250);
  // A total below current stock would read as 50/40, so stock wins.
  assert.strictEqual(itemTotal({ qty: 50, total: 40 }), 50);
});

test('nextTotal grows with stock-in and holds still on stock-out', () => {
  // 50 in stock, admin buys 100 -> 150/150, buys 100 more -> 250/250.
  const afterFirst = nextTotal({ qty: 50, total: 50 }, 150);
  assert.strictEqual(afterFirst, 150);
  assert.strictEqual(nextTotal({ qty: 150, total: afterFirst }, 250), 250);
  // Worker takes 10 -> 240/250.
  assert.strictEqual(nextTotal({ qty: 250, total: 250 }, 240), 250);
  assert.strictEqual(nextTotal({ qty: 250, total: 250 }, 0), 250);
});

test('mergeLoadedItem backfills the total for legacy items', () => {
  const defaults = [{ id: 'boot_42', name: '安全靴 Boot Size 42', sub: '', unit: 'pairs' }];
  assert.strictEqual(mergeLoadedItem({ id: 'boot_42', qty: 50 }, defaults).total, 50);
  assert.strictEqual(mergeLoadedItem({ id: 'boot_42', qty: 40, total: 250 }, defaults).total, 250);
});

test('cleanCompany trims, collapses spaces, and caps length', () => {
  assert.strictEqual(cleanCompany('  Top   Er Heng \n'), 'Top Er Heng');
  assert.strictEqual(cleanCompany(null), '');
  assert.strictEqual(cleanCompany('x'.repeat(200)).length, lib.COMPANY_MAX_LENGTH);
});

test('withCompany puts the newest company first and dedupes case-insensitively', () => {
  assert.deepStrictEqual(withCompany(['ABC'], 'Top Er Heng'), ['Top Er Heng', 'ABC']);
  assert.deepStrictEqual(withCompany(['Top Er Heng', 'ABC'], 'top er heng'), ['top er heng', 'ABC']);
  assert.deepStrictEqual(withCompany(['ABC', 'abc ', ''], ''), ['ABC']);
  assert.strictEqual(withCompany(Array.from({ length: 80 }, (_, i) => 'C' + i), 'New').length, 40);
});

test('index.html inline InventorySync mirrors lib/sync-behavior.js', () => {
  const inline = loadInlineMirror();
  const names = ['isInventoryPayload', 'syncFailureMessage', 'mergeLoadedItem', 'buildExportPayload',
    'itemTotal', 'nextTotal', 'cleanText', 'cleanCompany', 'withCompany'];
  names.forEach(name => assert.strictEqual(typeof inline[name], 'function', 'missing inline ' + name));
  assert.strictEqual(inline.COMPANY_MAX_LENGTH, lib.COMPANY_MAX_LENGTH);

  const items = [{ qty: 50 }, { qty: 50, total: null }, { qty: 40, total: 250 }, { qty: 50, total: 40 }, {}];
  items.forEach(item => assert.strictEqual(inline.itemTotal(item), lib.itemTotal(item), JSON.stringify(item)));
  [[{ qty: 50, total: 50 }, 150], [{ qty: 250, total: 250 }, 240], [{ qty: 0 }, 7]].forEach(([item, nq]) => {
    assert.strictEqual(inline.nextTotal(item, nq), lib.nextTotal(item, nq));
  });
  ['  Top   Er Heng ', null, 'x'.repeat(200)].forEach(value => {
    assert.strictEqual(inline.cleanCompany(value), lib.cleanCompany(value));
  });
  assert.deepStrictEqual(inline.withCompany(['ABC', 'abc'], 'Top Er Heng'), lib.withCompany(['ABC', 'abc'], 'Top Er Heng'));
  const defaults = [{ id: 'boot_42', name: 'Boot 42', sub: '', unit: 'pairs' }];
  assert.deepStrictEqual(
    inline.mergeLoadedItem({ id: 'boot_42', qty: 50 }, defaults),
    lib.mergeLoadedItem({ id: 'boot_42', qty: 50 }, defaults)
  );
  const state = { cats: [], items: [], history: [], purchases: [], companies: ['ABC'], customIcons: [] };
  assert.deepStrictEqual(inline.buildExportPayload(state, 5), lib.buildExportPayload(state, 5));
});

if (!process.exitCode) console.log('\nAll sync-behavior tests passed.');
