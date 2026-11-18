// Built-in artwork: illustrated wallpapers that ship with the app, so there is always something to pick
// (no photos to copy, no internet needed). They are drawings, not photographs.
(function (TV) {
  // scrim: how much black goes over the picture in Dark mode to keep text readable (your own photos get 0.42).
  // Each value is the least that passes the same worst-case contrast check as every theme (all 23 themes,
  // every cell of the artwork), plus a margin. These pictures are mostly dark already, so they need little.
  // Light mode always uses the normal white layer.
  TV.ART = [
    { id: 'dunes', name: 'Dunes', file: 'dunes.svg', scrim: 0.30 },
    { id: 'lake', name: 'Lake', file: 'lake.svg', scrim: 0.05 },
    { id: 'forest', name: 'Forest', file: 'forest.svg', scrim: 0.05 },
    { id: 'aurora', name: 'Aurora', file: 'aurora.svg', scrim: 0.05 },
    { id: 'ocean', name: 'Ocean', file: 'ocean.svg', scrim: 0.26 },
    { id: 'mountains', name: 'Mountains', file: 'mountains.svg', scrim: 0.22 },
    { id: 'city', name: 'City Night', file: 'city.svg', scrim: 0.05 },
    { id: 'moon', name: 'Moonlight', file: 'moon.svg', scrim: 0.26 }
  ];
  TV.artById = function (id) {
    for (var i = 0; i < TV.ART.length; i++) if (TV.ART[i].id === id) return TV.ART[i];
    return null;
  };
  // Where an artwork file lives (the single-file preview supplies TV.wallData instead of real files)
  TV.artUrl = function (art) {
    return (TV.wallData && TV.wallData['art/' + art.file]) || 'images/art/' + art.file;
  };
})(window.TV);
