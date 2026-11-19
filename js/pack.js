// Packs widget tiles into rows. A tile can span more than one column (the wide Spotify player spans 2).
// Pure function, so it is easy to test. (An item with solo: true gets a page of its own.)
(function (root) {
  // items: [{ span: 1 or more, ...anything else }], cols: columns per row, rowsPerPage: rows on one screen.
  // Returns { dense, pages }: dense is true when more than one row is needed, and
  // pages is a list of screens, each a list of rows, each a list of items.
  // An item with solo: true gets a page of its own (one row, so it is drawn at full size); the rest are packed as usual.
  function pack(items, cols, rowsPerPage) {
    if (!items.length) return { dense: false, pages: [[[]]] };
    var solos = items.filter(function (it) { return it.solo; });
    if (solos.length) {
      var rest = items.filter(function (it) { return !it.solo; });
      var base = rest.length ? pack(rest, cols, rowsPerPage) : { dense: false, pages: [] };
      return { dense: base.dense, pages: base.pages.concat(solos.map(function (it) { return [[{ item: it, span: Math.max(1, Math.min(cols, it.span || 1)) }]]; })) };
    }
    var capped = items.map(function (it) { return { item: it, span: Math.max(1, Math.min(cols, it.span || 1)) }; });
    var total = capped.reduce(function (s, c) { return s + c.span; }, 0);
    var maxSpan = capped.reduce(function (m, c) { return Math.max(m, c.span); }, 1);
    var dense = rowsPerPage > 1 && total > cols;

    // Fill rows in order, starting a new row when the next tile does not fit.
    function greedy(capacity) {
      var rows = [], row = [], used = 0;
      capped.forEach(function (c) {
        if (row.length && used + c.span > capacity) { rows.push(row); row = []; used = 0; }
        row.push(c); used += c.span;
      });
      if (row.length) rows.push(row);
      return rows;
    }

    // Same number of rows, but spread evenly (4 tiles become 2 + 2, not 3 + 1).
    var rows = greedy(cols);
    var balanced = greedy(Math.max(Math.ceil(total / rows.length), maxSpan));
    if (balanced.length <= rows.length) rows = balanced;

    var out = rows.map(function (r) { return r.map(function (c) { return { item: c.item, span: c.span }; }); });
    var pages = [];
    var perPage = dense ? rowsPerPage : 1;
    for (var i = 0; i < out.length; i += perPage) pages.push(out.slice(i, i + perPage));
    return { dense: dense, pages: pages };
  }

  var api = { pack: pack };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else { root.TV = root.TV || {}; root.TV.pack = api; }
})(typeof window !== 'undefined' ? window : this);
