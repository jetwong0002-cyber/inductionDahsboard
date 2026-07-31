/**
 * End-to-end checks for the safety store dashboard that index.html embeds as
 * base64 inside DASHBOARDS.safety. The real bootstrapSafety() from index.html
 * patches the dashboard, then it runs in jsdom against a fake /api/sync so the
 * stock/total numbers and the mandatory company on stock-out are covered.
 *
 * Requires jsdom (a devDependency). Without it the file skips instead of failing.
 */
const assert = require('assert');
const fs = require('fs');
const path = require('path');

let JSDOM;
try {
  ({ JSDOM } = require('jsdom'));
} catch (e) {
  console.log('skip - safety dashboard tests (run `npm install` to get jsdom)');
  return;
}

const INDEX_HTML = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');

function extractFunction(source, name) {
  const start = source.indexOf('function ' + name + '(');
  assert.ok(start >= 0, 'missing function ' + name + ' in index.html');
  let depth = 0;
  for (let i = source.indexOf('{', start); i < source.length; i++) {
    if (source[i] === '{') depth++;
    else if (source[i] === '}' && --depth === 0) return source.slice(start, i + 1);
  }
  throw new Error('unbalanced braces in ' + name);
}

function decodeSafetyDashboard() {
  const match = INDEX_HTML.match(/^\s*safety:\s*"([^"]*)",?\s*$/m);
  assert.ok(match, 'DASHBOARDS.safety not found in index.html');
  return Buffer.from(match[1], 'base64').toString('utf8');
}

function bootstrap(session) {
  const helpers = extractFunction(INDEX_HTML, 'replaceRequired') + '\n' +
    extractFunction(INDEX_HTML, 'bootstrapSafety');
  const bootstrapSafety = new Function('session', helpers + '\nreturn bootstrapSafety;')(session);
  return bootstrapSafety(decodeSafetyDashboard());
}

function openDashboard(session, initialData) {
  const server = { store: initialData, posts: 0 };
  const dom = new JSDOM(bootstrap(session), {
    runScripts: 'dangerously',
    url: 'https://example.test/',
    beforeParse(win) {
      // jsdom ships no fetch API; the dashboard's sync wrapper needs both.
      win.Response = Response;
      win.Headers = Headers;
      win.fetch = (input, init) => {
        const method = String((init && init.method) || 'GET').toUpperCase();
        if (method === 'POST') {
          server.posts += 1;
          server.store = JSON.parse(init.body);
          return Promise.resolve(new win.Response('{"success":true}', jsonInit()));
        }
        return Promise.resolve(new win.Response(JSON.stringify(server.store), jsonInit()));
      };
      function jsonInit() {
        return { status: 200, headers: { 'Content-Type': 'application/json' } };
      }
    },
  });
  return { dom, win: dom.window, doc: dom.window.document, server };
}

function sampleData() {
  return {
    cats: [{ id: 'safety', name: '安全设备 Safety', color: '#e6f1fb' }],
    items: [
      // No `total`: exactly what rows saved before this feature look like.
      { id: 'boot_42', cat: 'safety', name: '安全靴 Boot Size 42', sub: '', unit: 'pairs', qty: 50, low: 3, icon: '🥾' },
      { id: 'helmet_red', cat: 'safety', name: '安全帽(红) Helmet Red', sub: '', unit: 'pcs', qty: 7, low: 2, icon: '⛑️' },
    ],
    history: [],
    purchases: [],
    collapsed: {},
    customIcons: [],
  };
}

const settle = (ms = 60) => new Promise(resolve => setTimeout(resolve, ms));
const tests = [];
function test(name, fn) { tests.push([name, fn]); }

test('worker flow: totals grow with stock-in and every stock-out names a company', async () => {
  const { dom, win, doc, server } = openDashboard({ name: 'Aung', role: 'worker', token: 't' }, sampleData());
  const badge = id => doc.querySelector(`.card[data-item-id="${id}"] .qbadge`).textContent.trim();
  const state = expr => JSON.parse(win.eval('JSON.stringify(' + expr + ')'));
  try {
    await settle(150);
    assert.strictEqual(badge('boot_42'), '50/50', 'stock saved without a total starts at qty/qty');
    assert.match(doc.getElementById('stats').textContent, /57 \/ 57/);

    // Admin bought 100 pairs: 50 -> 150/150, then 100 more -> 250/250.
    doc.querySelector('.card[data-item-id="boot_42"] .cb.add').click();
    await settle();
    assert.match(doc.getElementById('sheet').textContent, /入库 Add Stock/);
    doc.getElementById('rs-qty').value = '100';
    win.doRestock('boot_42');
    await settle(150);
    assert.strictEqual(badge('boot_42'), '150/150');

    win.openRestock('boot_42');
    await settle();
    doc.getElementById('rs-qty').value = '100';
    win.doRestock('boot_42');
    await settle(150);
    assert.strictEqual(badge('boot_42'), '250/250');

    // Taking stock out is refused until the collecting company is filled in.
    doc.querySelector('.card[data-item-id="boot_42"] .cb.sub').click();
    await settle();
    assert.match(doc.getElementById('sheet').textContent, /领取出库 Take Out/);
    win.doTakeOut('boot_42');
    await settle();
    assert.match(doc.getElementById('toast').textContent, /请填哪间公司/);
    assert.strictEqual(badge('boot_42'), '250/250', 'no stock moved without a company');

    doc.getElementById('to-qty').value = '10';
    doc.getElementById('to-company').value = '  Top Er   Heng ';
    doc.getElementById('to-person').value = 'Ali';
    win.doTakeOut('boot_42');
    await settle(200);
    assert.strictEqual(badge('boot_42'), '240/250', 'stock-out lowers stock but not the total');

    const history = state('state.history');
    const last = history[history.length - 1];
    assert.strictEqual(last.company, 'Top Er Heng');
    assert.strictEqual(last.person, 'Ali');
    assert.strictEqual(last.delta, -10);
    assert.strictEqual(last.total, 250);
    assert.deepStrictEqual(server.store.companies, ['Top Er Heng']);
    assert.strictEqual(server.store.items.find(i => i.id === 'boot_42').total, 250);

    // The company is offered as a chip and pre-filled next time.
    win.openTakeOut('helmet_red', 1);
    await settle();
    const chips = [...doc.querySelectorAll('#to-chips .co-chip')].map(b => b.textContent.trim());
    assert.ok(chips.some(c => c.includes('Top Er Heng')), 'expected a company chip, got ' + JSON.stringify(chips));
    assert.strictEqual(doc.getElementById('to-company').value, 'Top Er Heng');
    win.doTakeOut('helmet_red');
    await settle(200);
    assert.strictEqual(badge('helmet_red'), '6/7');

    // Typing a smaller quantity is a stock-out too.
    win.startQty('boot_42');
    await settle();
    doc.getElementById('qi_boot_42').value = '230';
    win.commitQty('boot_42');
    await settle();
    assert.match(doc.getElementById('sheet').textContent, /领取出库 Take Out/);
    assert.strictEqual(doc.getElementById('to-qty').value, '10', 'take-out prefills the difference');
    assert.strictEqual(badge('boot_42'), '240/250');
    doc.getElementById('to-company').value = 'ABC Sdn Bhd';
    win.doTakeOut('boot_42');
    await settle(200);
    assert.strictEqual(badge('boot_42'), '230/250');

    // Typing a bigger quantity counts as newly bought stock.
    win.startQty('boot_42');
    await settle();
    doc.getElementById('qi_boot_42').value = '260';
    win.commitQty('boot_42');
    await settle(200);
    assert.strictEqual(badge('boot_42'), '260/280');

    // History shows the company and can be narrowed down to one.
    win.switchTab('hist');
    await settle();
    assert.ok(doc.getElementById('list').textContent.includes('Top Er Heng'));
    win.setHistFilter('ABC Sdn Bhd');
    await settle();
    const rows = [...doc.querySelectorAll('.hist-row')].map(r => r.textContent);
    assert.strictEqual(rows.length, 1);
    assert.ok(rows[0].includes('ABC Sdn Bhd'));
    win.setHistFilter('all');

    // Exports carry the same numbers.
    const files = [];
    win.downloadFile = (name, content) => files.push(content);
    win.exportStockCSV();
    win.exportHistoryCSV();
    assert.match(files[0], /总数 Total Bought/);
    assert.match(files[0], /,260,280,20,/, 'stock CSV should list qty, total and used');
    assert.match(files[1], /公司 Company/);
    assert.ok(files[1].includes('Top Er Heng'));

    assert.ok(server.posts >= 6, 'every change should be persisted, posts=' + server.posts);
  } finally {
    dom.window.close();
  }
});

test('visitor stays read-only and still sees the totals', async () => {
  const { dom, win, doc, server } = openDashboard({ name: 'Camilia', role: 'visitor', token: 't' }, sampleData());
  try {
    await settle(150);
    assert.ok(doc.body.classList.contains('view-only'));
    assert.strictEqual(doc.querySelector('.qbadge').textContent.trim(), '50/50');
    win.openTakeOut('boot_42', 1);
    win.openRestock('boot_42');
    await settle();
    assert.strictEqual(doc.getElementById('overlay').style.display, 'none');
    assert.match(doc.getElementById('toast').textContent, /View Only/);
    assert.strictEqual(server.posts, 0);
  } finally {
    dom.window.close();
  }
});

(async () => {
  for (const [name, fn] of tests) {
    try {
      await fn();
      console.log('ok -', name);
    } catch (e) {
      console.error('FAIL -', name);
      console.error(e.message);
      process.exitCode = 1;
    }
  }
  if (!process.exitCode) console.log('\nAll safety dashboard tests passed.');
  process.exit(process.exitCode || 0);
})();
