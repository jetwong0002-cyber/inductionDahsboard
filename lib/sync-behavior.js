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

  function mergeLoadedItem(item, defaults) {
    const base = (defaults || []).find(x => x.id === item.id) || {};
    return Object.assign({}, base, item, {
      name: item.name != null && item.name !== '' ? item.name : base.name,
      sub: item.sub != null ? item.sub : base.sub,
      unit: item.unit != null && item.unit !== '' ? item.unit : base.unit,
    });
  }

  function buildExportPayload(state, ts) {
    return {
      version: 2,
      ts: ts != null ? ts : Date.now(),
      cats: state.cats,
      items: state.items,
      history: (state.history || []).slice(-50),
      purchases: (state.purchases || []).slice(-500),
      customIcons: state.customIcons || [],
    };
  }

  return { isInventoryPayload, syncFailureMessage, mergeLoadedItem, buildExportPayload };
});
