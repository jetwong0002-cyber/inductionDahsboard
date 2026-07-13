# Stock-first UX redesign

**Date:** 2026-07-13  
**App:** safety-inventory  
**Status:** Approved for planning  

## Goal

Make the warehouse inventory app easier for **floor staff** by reducing home-screen clutter, while keeping History and Purchases available and supporting **phone + laptop** layouts.

## Decisions (from brainstorming)

| Topic | Choice |
|-------|--------|
| Main friction | Too much on screen |
| Primary user | Floor staff (find item → +/− → done) |
| Labels | English primary, Chinese secondary |
| Hide from home | Import/Share/Export; edit/add/unit controls |
| Keep as tabs | Stock, History, Purchases |
| Approach | Stock-first home (not dual Work/Admin modes) |
| Boss view | Keep `?mode=boss` URL only — **do not** surface a Boss link in the UI |

## Information architecture

### Home (Stock) — default

Always visible:

- Title + sync status
- **More** entry point
- Search
- Low-stock filter
- Stats (phone: Types + Low; laptop: Types + Low + Purchases)
- Category groups + item cards with **+/− qty only**

Not on home by default:

- Import / Share / Excel export
- Edit item (⋮), add-item buttons, unit editor, purchase shortcut on each row
- Add tab in the bottom bar

### Tabs / navigation

- **Phone (under 900px):** bottom tabs — Stock · History · Buy
- **Laptop (900px and up):** left sidebar — Stock · History · Purchases · More

### More sheet

Contents only:

1. Import data  
2. Share / Export Excel  
3. Manage items (toggle On/Off)

No Boss view link.

### Manage mode

- Local UI flag only (not synced to the database); default **Off**
- When **On:** show edit (⋮), per-category Add item, unit editing affordances (same behaviors as today)
- When **Off:** stock interaction is search/filter/+/− (and tap qty to type) only
- Optional visible chip: “Manage mode” while On

### Boss / view-only

Unchanged: `?mode=boss` remains a separate URL the owner shares manually. Redesign must not break view-only restrictions.

## Visual design

### Color

- Primary brand: blue header / sidebar (`#1d4ed8` family)
- Soft page background (light blue → slate wash on phone)
- Category accent bar on cards (reuse existing category colors)
- Low-stock: red accents on badge, qty, and card border
- +/−: green / red filled circular controls (stronger than current outline-only)

### Typography / labels

- Item **English name** as primary (`font-weight: 700`)
- **Chinese** (and unit) as secondary muted line under the name
- Parse existing bilingual `name` strings when needed (e.g. `安全帽(黄) Helmet Yellow` → primary `Helmet Yellow`, secondary `安全帽(黄)`), without requiring a DB migration
- Tabs and chrome: English-first short labels (Stock / History / Buy)

### Adaptive layout

| Viewport | Layout |
|----------|--------|
| under 900px | Single column; sticky blue header; bottom tab bar; More in header |
| 900px and up | CSS grid: ~220px sidebar + main; item cards in 2 columns; 3 stat cards |

Same feature set on both sizes; only structure changes.

## Technical scope

### In scope

- CSS/layout redesign in `index.html` (and shared helpers if needed)
- More sheet + Manage toggle wiring
- Hide Import/Share/edit/add from default Stock UI; open them from More / Manage
- English-primary display helper for item names
- Responsive breakpoints for phone vs laptop
- Preserve existing sync, purchases, history, CSV export, and boss mode behavior

### Out of scope

- New backend tables or API routes
- Replacing `?mode=boss` with auth
- Removing History or Purchases features
- Full redesign of purchase-logging form internals (keep current sheet flows)

## Error handling

Keep the recent sync-error visibility behavior:

- Failed `/api/sync` must not show “Synced”
- Manage toggle and More sheet do not affect sync payloads

## Testing

- Unit: name-split helper (English primary / Chinese secondary) for representative bilingual strings and English-only / Chinese-only edge cases
- Manual: phone width and ≥900px width — navigation, More, Manage on/off, +/−, low filter, History, Purchases, boss mode still view-only
- Regression: `npm test` for existing sync-behavior tests still passes

## Success criteria

1. Floor staff can adjust stock without seeing Import/Share or edit/add controls.  
2. English reads first on stock cards; Chinese remains visible secondary.  
3. Layout is usable on phone and laptop without horizontal cramping.  
4. All previous data features remain reachable via More or Manage.  
5. Boss view-only URL still works and is not advertised in the app chrome.
