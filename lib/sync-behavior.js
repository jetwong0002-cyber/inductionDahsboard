(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.InventorySync = factory();
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function isInventoryPayload(d) {
    return !!(d && typeof d === 'object' && !Array.isArray(d) && Array.isArray(d.items) && !d.error);
  }

  function syncFailureMessage(res, body) {
    if (res && res.ok && !(body && body.error)) return null;
    if (body && body.error) return String(body.error);
    return 'HTTP ' + ((res && res.status) || '?');
  }

  function toCount(value) {
    const n = Math.floor(Number(value));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }

  // Lifetime quantity ever stocked in. Legacy rows have no `total`, so the
  // current stock becomes the starting total instead of showing 0.
  function itemTotal(item) {
    const qty = toCount(item && item.qty);
    const stored = item && item.total;
    const total = stored == null || !Number.isFinite(Number(stored)) ? qty : toCount(stored);
    return Math.max(total, qty);
  }

  // Stock-in raises the total, taking stock out never lowers it.
  function nextTotal(item, newQty) {
    const nq = toCount(newQty);
    const added = Math.max(0, nq - toCount(item && item.qty));
    return Math.max(itemTotal(item) + added, nq);
  }

  function cleanText(value, maxLength) {
    const text = String(value == null ? '' : value).replace(/\s+/g, ' ').trim();
    return maxLength ? text.slice(0, maxLength) : text;
  }

  const COMPANY_MAX_LENGTH = 60;
  const COMPANY_LIST_LIMIT = 40;

  function cleanCompany(value) {
    return cleanText(value, COMPANY_MAX_LENGTH);
  }

  // Most-recently-used first, case-insensitive dedupe, keeps the first spelling.
  function withCompany(list, name) {
    const company = cleanCompany(name);
    const seen = new Set();
    const out = [];
    const push = value => {
      const clean = cleanCompany(value);
      if (!clean) return;
      const key = clean.toLowerCase();
      if (seen.has(key)) return;
      seen.add(key);
      out.push(clean);
    };
    push(company);
    (Array.isArray(list) ? list : []).forEach(push);
    return out.slice(0, COMPANY_LIST_LIMIT);
  }

  function mergeLoadedItem(item, defaults) {
    const base = (defaults || []).find(x => x.id === item.id) || {};
    const merged = Object.assign({}, base, item, {
      name: item.name != null && item.name !== '' ? item.name : base.name,
      sub: item.sub != null ? item.sub : base.sub,
      unit: item.unit != null && item.unit !== '' ? item.unit : base.unit,
    });
    merged.total = itemTotal(merged);
    return merged;
  }

  function buildExportPayload(state, ts) {
    return {
      version: 2,
      ts: ts != null ? ts : Date.now(),
      cats: state.cats,
      items: state.items,
      history: (state.history || []).slice(-50),
      purchases: (state.purchases || []).slice(-500),
      companies: state.companies || [],
      customIcons: state.customIcons || [],
    };
  }

  return {
    isInventoryPayload,
    syncFailureMessage,
    mergeLoadedItem,
    buildExportPayload,
    itemTotal,
    nextTotal,
    cleanText,
    cleanCompany,
    withCompany,
    COMPANY_MAX_LENGTH,
  };
});
