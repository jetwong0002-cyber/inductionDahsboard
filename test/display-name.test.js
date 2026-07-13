const assert = require('assert');
const { splitDisplayName } = require('../lib/display-name');

function test(name, fn) {
  try { fn(); console.log('ok -', name); }
  catch (e) { console.error('FAIL -', name); console.error(e.message); process.exitCode = 1; }
}

test('splits Chinese-then-English into English primary', () => {
  const r = splitDisplayName('安全帽(黄) Helmet Yellow');
  assert.strictEqual(r.primary, 'Helmet Yellow');
  assert.strictEqual(r.secondary, '安全帽(黄)');
});

test('splits English-only name with empty secondary', () => {
  const r = splitDisplayName('Cutting Disc 107');
  assert.strictEqual(r.primary, 'Cutting Disc 107');
  assert.strictEqual(r.secondary, '');
});

test('Chinese-only name stays primary with empty secondary', () => {
  const r = splitDisplayName('威猛先生');
  assert.strictEqual(r.primary, '威猛先生');
  assert.strictEqual(r.secondary, '');
});

test('splits English-then-Chinese into English primary', () => {
  const r = splitDisplayName('Mr. Muscle 威猛先生');
  assert.strictEqual(r.primary, 'Mr. Muscle');
  assert.strictEqual(r.secondary, '威猛先生');
});

test('handles empty / missing name', () => {
  assert.deepStrictEqual(splitDisplayName(''), { primary: '', secondary: '' });
  assert.deepStrictEqual(splitDisplayName(null), { primary: '', secondary: '' });
});

if (!process.exitCode) console.log('\nAll display-name tests passed.');
