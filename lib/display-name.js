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
      const m2 = raw.match(/^([A-Za-z].+)[\s\u3000]+([\u3400-\u9FFF\uF900-\uFAFF].*)$/);
      if (m2) return { primary: m2[1].trim(), secondary: m2[2].trim() };
    }
    return { primary: raw, secondary: '' };
  }

  return { splitDisplayName };
});
