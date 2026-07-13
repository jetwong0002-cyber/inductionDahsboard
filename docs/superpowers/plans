# Stock-First UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Redesign the inventory UI so floor staff get a decluttered stock-first home (English-primary labels, More/Manage progressive disclosure, phone + laptop adaptive layout) without changing backend sync.

**Architecture:** Keep the single-page `index.html` app and Neon `/api/sync` backend. Extract a small pure helper (`lib/display-name.js`) for bilingual label splitting (unit-tested). Add a local `manageMode` flag and a More sheet for Import/Export/Manage. Use CSS breakpoints at 900px for phone (bottom tabs) vs laptop (sidebar + 2-column grid).

**Tech Stack:** Vanilla HTML/CSS/JS, Node assert tests (`npm test`), Vercel static + `api/sync.js` (unchanged API contract).

**Spec:** `docs/superpowers/specs/2026-07-13-stock-first-ux-design.md`

---

## File map

| File | Responsibility |
|------|----------------|
| `lib/display-name.js` | Pure helper: split bilingual item names into `{ primary, secondary }` |
| `test/display-name.test.js` | Unit tests for display-name helper |
| `lib/sync-behavior.js` | Existing sync helpers (unchanged unless build copy list updates) |
| `index.html` | UI markup, CSS redesign, More/Manage wiring, responsive layout, render changes |
| `package.json` | `test` runs both test files; `build` copies new lib file into `public/lib/` |
| `api/sync.js` | No functional changes in this plan |

---

### Task 1: Bilingual display-name helper (TDD)

**Files:**
- Create: `lib/display-name.js`
- Create: `test/display-name.test.js`
- Modify: `package.json` (test script)

- [ ] **Step 1: Write the failing test**

Create `test/display-name.test.js`:

```js
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

test('handles empty / missing name', () => {
  assert.deepStrictEqual(splitDisplayName(''), { primary: '', secondary: '' });
  assert.deepStrictEqual(splitDisplayName(null), { primary: '', secondary: '' });
});

if (!process.exitCode) console.log('\nAll display-name tests passed.');
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node test/display-name.test.js`

Expected: `Cannot find module '../lib/display-name'` (or similar FAIL)

- [ ] **Step 3: Write minimal implementation**

Create `lib/display-name.js`:

```js
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InventoryDisplay = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // Han script / CJK unified ideographs + compatibility
  const HAS_CJK = /[\u3400-\u9FFF\uF900-\uFAFF]/;
  const HAS_LATIN = /[A-Za-z]/;

  function splitDisplayName(name) {
    if (name == null) return { primary: '', secondary: '' };
    const raw = String(name).trim();
    if (!raw) return { primary: '', secondary: '' };

    // Pattern: "<chinese...> <English...>" (English starts at first Latin letter run after CJK)
    if (HAS_CJK.test(raw) && HAS_LATIN.test(raw)) {
      const m = raw.match(/^(.*?)[\s\u3000]+([A-Za-z].*)$/);
      if (m && HAS_CJK.test(m[1]) && HAS_LATIN.test(m[2])) {
        return { primary: m[2].trim(), secondary: m[1].trim() };
      }
      // Fallback: English-first then Chinese
      const m2 = raw.match(/^([A-Za-z].*?)[\s\u3000]+(.*[\u3400-\u9FFF].*)$/);
      if (m2) return { primary: m2[1].trim(), secondary: m2[2].trim() };
    }
    return { primary: raw, secondary: '' };
  }

  return { splitDisplayName };
});
```

- [ ] **Step 4: Wire npm test and verify pass**

Update `package.json` scripts:

```json
"test": "node test/sync-behavior.test.js && node test/display-name.test.js",
"build": "mkdir -p public/lib && cp index.html public/ && cp lib/sync-behavior.js public/lib/ && cp lib/display-name.js public/lib/"
```

Run: `npm test`

Expected: all sync-behavior + display-name tests pass

- [ ] **Step 5: Commit**

```bash
git add lib/display-name.js test/display-name.test.js package.json
git commit -m "feat: add bilingual display-name helper with tests"
```

---

### Task 2: Load helper in the page and use English-primary labels in stock cards

**Files:**
- Modify: `index.html` (script tag + `render()` card name markup)

- [ ] **Step 1: Add script tag after sync-behavior**

In `index.html`, after `<script src="/lib/sync-behavior.js"></script>`, add:

```html
<script src="/lib/display-name.js"></script>
```

At the top of the main script (near InventorySync destructure):

```js
const { splitDisplayName } = window.InventoryDisplay;
```

- [ ] **Step 2: Update stock card title rendering in `render()`**

Replace the card name line that currently outputs `${it.name}` with:

```js
const dn = splitDisplayName(it.name);
// inside card-info:
`
<div class="card-name">${dn.primary}</div>
<div class="card-sub">
  ${dn.secondary ? `<span class="name-zh">${dn.secondary}</span>` : ''}
  <span class="unit-tag" onclick="openEditUnit('${it.id}')">${getUnitLabel(it.unit)}</span>
  ${it.sub ? `<span style="color:var(--color-text-tertiary)">${it.sub}</span>` : ''}
  ${isLow ? '<span class="low-badge">Low</span>' : ''}
</div>
`
```

Keep History/Purchase record names as stored (no change required there).

- [ ] **Step 3: Smoke-check helper in Node against DEFAULT sample strings**

Run:

```bash
node -e "const {splitDisplayName}=require('./lib/display-name'); console.log(splitDisplayName('安全帽(黄) Helmet Yellow')); console.log(splitDisplayName('威猛先生 Mr. Muscle'));"
```

Expected: English primary for both.

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: show English-primary item names on stock cards"
```

---

### Task 3: Stock-first chrome — More button, drop header Import/Share and Add tab

**Files:**
- Modify: `index.html` (header HTML + tab bar HTML + `switchTab`)

- [ ] **Step 1: Replace header action buttons**

Change the header `.hbtns` block from Import/Share to a single More button:

```html
<div class="hbtns">
  <button class="hbtn" id="more-btn" onclick="openMore()">⋯ More</button>
</div>
```

Update title text to English-first: `Inventory` (keep emoji optional).

- [ ] **Step 2: Remove Add tab from bottom bar**

Tab bar becomes three tabs only:

```html
<div class="tab-bar" id="tab-bar">
  <button class="tab on" id="t-inv" onclick="switchTab('inv')"><span style="font-size:20px">📦</span>Stock</button>
  <button class="tab" id="t-hist" onclick="switchTab('hist')"><span style="font-size:20px">📜</span>History</button>
  <button class="tab" id="t-buy" onclick="switchTab('buy')"><span style="font-size:20px">🛒</span>Buy</button>
</div>
```

Update `switchTab` so it no longer references `t-add` / `'add'`.

- [ ] **Step 3: Add stub `openMore()` that toasts until Task 4**

```js
function openMore(){ toast('More coming'); }
```

(Replace fully in Task 4.)

- [ ] **Step 4: Commit**

```bash
git add index.html
git commit -m "feat: replace import/share/add chrome with More entry"
```

---

### Task 4: More sheet + Manage mode flag

**Files:**
- Modify: `index.html` (state + `openMore` + `setManageMode` + view-only guards)

- [ ] **Step 1: Add local state**

Near other globals:

```js
let manageMode = false;
```

Do **not** persist `manageMode` through `save()` / sync payload.

- [ ] **Step 2: Implement `openMore()` sheet (no Boss link)**

```js
function openMore(){
  document.getElementById('sheet').innerHTML = `
    <div class="sheet-title">More</div>
    <div class="sheet-sub">Import, export, and item management</div>
    <button class="more-row" onclick="closeSheet(); openImport()">📥 Import data</button>
    <button class="more-row" onclick="closeSheet(); openExport()">📤 Share / Export Excel</button>
    <button class="more-row manage-toggle" onclick="setManageMode(!manageMode)">
      🛠️ Manage items
      <span class="manage-pill">${manageMode ? 'On' : 'Off'}</span>
    </button>`;
  document.getElementById('overlay').style.display = 'flex';
}

function setManageMode(on){
  manageMode = !!on;
  closeSheet();
  render();
  toast(manageMode ? '🛠️ Manage mode On' : 'Manage mode Off');
}
```

Add minimal CSS for `.more-row` / `.manage-pill` (full-width list rows matching the approved mockup).

- [ ] **Step 3: Gate manage-only controls in `render()`**

In the stock list card template:

- Always show − qty +
- Only if `manageMode`: show `edit-btn` (⋮), and make `.unit-tag` clickable (otherwise render unit as plain text, no `openEditUnit`)
- Do **not** render per-row `buy-btn` on stock cards (purchases via Buy tab)
- Only if `manageMode`: render the per-category `add-item-btn`

Also show a small chip in the header when `manageMode` is true: `🛠️ Manage`.

- [ ] **Step 4: Boss view-only still wins**

In the existing `isViewOnly` block, also force:

```js
manageMode = false;
window.openMore = () => toast('👁️ Browse mode View Only');
window.setManageMode = () => toast('👁️ Browse mode View Only');
```

Update CSS so `body.view-only #more-btn` is hidden (or keep More but blocked — prefer hide).

- [ ] **Step 5: Manual logic check via Node extract (optional) + commit**

```bash
git add index.html
git commit -m "feat: add More sheet and local Manage mode"
```

---

### Task 5: Visual redesign (color) — phone layout CSS

**Files:**
- Modify: `index.html` `<style>` block and structural class names as needed

- [ ] **Step 1: Extend CSS variables**

Add (keep existing vars; override/extend):

```css
:root{
  --color-brand:#1d4ed8;
  --color-brand-2:#2563eb;
  --color-header-text:#ffffff;
  --color-page-wash:#eff6ff;
}
body{background:linear-gradient(180deg,var(--color-page-wash) 0%,#f8fafc 45%);}
.header{
  background:linear-gradient(135deg,var(--color-brand),var(--color-brand-2));
  color:var(--color-header-text);
  border-bottom:none;
}
.title,.sync-status{color:#fff}
.sync-status{background:rgba(255,255,255,.2)}
.sync-status.synced{background:rgba(16,185,129,.25);color:#ecfdf5}
.sync-status.offline{background:rgba(254,226,226,.95);color:#991b1b}
.card{border-left:4px solid var(--color-border-info)}
.card.low{border-left-color:var(--color-text-danger);border-color:#fecaca}
.cb.sub{background:#fef2f2;border-color:transparent;color:var(--color-text-danger)}
.cb.add{background:#ecfdf5;border-color:transparent;color:var(--color-text-success)}
.name-zh{color:var(--color-text-tertiary)}
```

When rendering cards, add class `low` when `isLow`.

Widen `.app` max-width rules later in Task 6; for phone keep `max-width:420px` centered.

- [ ] **Step 2: Stats styling**

Phone stats stay 2 columns (Types / Low). Style numbers with brand/danger colors per mockup.

Update `renderStats()`:

```js
function renderStats(){
  let low=0; state.items.forEach(i=>{ if(i.qty<=i.low) low++; });
  const buys=(state.purchases||[]).length;
  document.getElementById('stats').innerHTML=`
    <div class="stat"><div class="stat-v brand">${state.items.length}</div><div class="stat-l">Types</div></div>
    <div class="stat danger"><div class="stat-v">${low}</div><div class="stat-l">Low stock</div></div>
    <div class="stat purchase desktop-only"><div class="stat-v">${buys}</div><div class="stat-l">Purchases</div></div>`;
}
```

Hide `.desktop-only` by default; show at ≥900px in Task 6.

- [ ] **Step 3: Commit**

```bash
git add index.html
git commit -m "feat: apply stock-first color styling for phone"
```

---

### Task 6: Adaptive laptop layout (≥900px)

**Files:**
- Modify: `index.html` (markup wrapper + CSS media query + optional sidebar nav)

- [ ] **Step 1: Add desktop sidebar markup**

Wrap or add alongside the mobile tab bar:

```html
<aside class="side-nav" id="side-nav" aria-label="Main">
  <div class="side-brand">Inventory</div>
  <div class="side-sync" id="side-sync"></div>
  <button class="side-link on" id="s-inv" onclick="switchTab('inv')">📦 Stock</button>
  <button class="side-link" id="s-hist" onclick="switchTab('hist')">📜 History</button>
  <button class="side-link" id="s-buy" onclick="switchTab('buy')">🛒 Purchases</button>
  <button class="side-link side-more" onclick="openMore()">⋯ More</button>
</aside>
```

Mirror sync text into `#side-sync` whenever `syncStatusEl` updates (small helper `setSyncUi(text, className)` used by load/save/adj).

- [ ] **Step 2: CSS media query**

```css
.side-nav{display:none}
.desktop-only{display:none}
@media (min-width:900px){
  body{background:#f8fafc}
  .app-shell{display:grid;grid-template-columns:220px 1fr;min-height:100vh;max-width:1100px;margin:0 auto}
  .side-nav{display:flex;flex-direction:column;gap:6px;padding:16px 12px;background:linear-gradient(180deg,#1e3a8a,#1d4ed8);color:#fff}
  .tab-bar{display:none}
  .header{background:#fff;color:inherit;border-bottom:1px solid var(--color-border-tertiary)}
  .title{color:var(--color-text-primary)}
  /* restore sync pill colors for light header */
  .desktop-only{display:block}
  #stats{grid-template-columns:repeat(3,1fr)}
  #list .cg{/* optional */}
  .card-grid{display:contents}
  /* two-column cards: render categories full width; cards as grid */
  .cg-items{display:grid;grid-template-columns:1fr 1fr;gap:8px}
  .app{max-width:none;padding-bottom:24px}
  #more-btn{display:none} /* More lives in sidebar on laptop */
}
```

Wrap existing `.app` + `aside` in `<div class="app-shell">...</div>`.

- [ ] **Step 3: Update `render()` category HTML**

Wrap item cards (not the category header) in `<div class="cg-items">...</div>` so the 2-column grid applies on desktop.

- [ ] **Step 4: Keep `switchTab` in sync with sidebar active classes**

When switching tabs, toggle `.on` on both `#t-*` and `#s-*` buttons.

- [ ] **Step 5: Commit**

```bash
git add index.html
git commit -m "feat: add laptop sidebar and two-column stock grid"
```

---

### Task 7: Build copy, regression tests, verification

**Files:**
- Modify: `package.json` (already updated in Task 1 — confirm)
- Verify: `index.html`, `lib/*`

- [ ] **Step 1: Run full test suite**

Run: `npm test`

Expected: all tests pass (sync-behavior + display-name)

- [ ] **Step 2: Run build**

Run: `npm run build`

Expected: `public/index.html`, `public/lib/sync-behavior.js`, `public/lib/display-name.js` exist

- [ ] **Step 3: Checklist against spec success criteria**

Verify by code inspection (and browser if available):

1. Default stock view has no Import/Share/edit/add/buy-row controls  
2. English primary / Chinese secondary on cards  
3. `@media (min-width:900px)` sidebar + 2-col grid present  
4. More → Import / Export / Manage only (no Boss link)  
5. `?mode=boss` still disables edits; More hidden or blocked  

- [ ] **Step 4: Final commit + push**

```bash
git add -A
git status
git commit -m "feat: finish stock-first UX redesign verification"
git push -u origin HEAD
```

---

## Spec coverage check

| Spec requirement | Task |
|------------------|------|
| Declutter home for floor staff | 3, 4 |
| English primary / Chinese secondary | 1, 2 |
| Hide Import/Share from home → More | 3, 4 |
| Hide edit/add behind Manage | 4 |
| Keep History + Purchases tabs | 3, 6 |
| No Boss link in UI | 4 |
| Colorful blue branded UI | 5 |
| Phone vs laptop adaptive | 5, 6 |
| Preserve sync / boss mode | 4, 7 |
| Unit tests for name split + regression | 1, 7 |

## Out of scope reminder

Do not change `api/sync.js` contract, add auth for boss mode, or redesign purchase form internals beyond chrome/navigation consistency.
