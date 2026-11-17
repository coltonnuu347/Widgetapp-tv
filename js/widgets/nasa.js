// NASA Astronomy Picture of the Day. Also available as a background in the Theme panel.
(function (TV) {
  var CACHE_KEY = 'tvdash.nasa';
  var photo = null; // { url, title, credit, date }

  function isoDate(d) { return d.getFullYear() + '-' + TV.pad(d.getMonth() + 1) + '-' + TV.pad(d.getDate()); }

  function load() {
    var today = isoDate(new Date());
    var cached = TV.storage.get(CACHE_KEY, null);
    if (cached && cached.fetchedOn === today) { set(cached); return; }
    var key = encodeURIComponent(TV_CONFIG.nasaApiKey || 'DEMO_KEY');
    var start = isoDate(TV.addDays(new Date(), -7));
    // Ask for the last week so we can fall back to the newest photo when today's entry is a video.
    TV.fetchJSON('https://api.nasa.gov/planetary/apod?thumbs=false&api_key=' + key + '&start_date=' + start).then(function (list) {
      var images = (Array.isArray(list) ? list : [list]).filter(function (x) { return x.media_type === 'image' && x.url; });
      if (!images.length) throw new Error('No photo this week');
      var p = images[images.length - 1];
      var data = { url: p.url, title: p.title || '', credit: (p.copyright || '').replace(/\s+/g, ' ').trim(), date: p.date, explanation: p.explanation || '', fetchedOn: today };
      TV.storage.set(CACHE_KEY, data);
      set(data);
    }).catch(function (e) {
      TV.log('NASA failed:', e.message);
      if (cached) set(cached);
    });
  }

  function set(p) {
    photo = p;
    TV.nasaPhoto = { url: p.url, title: p.title };
    TV.emit('nasa', p);
    TV.widgets.update('nasa');
  }

  TV.widgets.register({
    id: 'nasa',
    name: 'NASA Space Photo',
    visible: function () { return !!photo; },
    init: function () {
      load();
      setInterval(load, 60 * 60 * 1000);
    },
    render: function (el) {
      if (el.getAttribute('data-built') === photo.url) return;
      el.setAttribute('data-built', photo.url);
      el.innerHTML = '<div class="nasa-img" style="background-image:url(&quot;' + TV.esc(photo.url) + '&quot;)"></div>' +
        '<div class="nasa-caption">' + TV.widgetHeader('sparkles', 'NASA Picture of the Day') +
        '<div class="nasa-title">' + TV.esc(photo.title) + '</div>' +
        (photo.credit ? '<div class="nasa-credit">© ' + TV.esc(photo.credit) + '</div>' : '') + '</div>';
    },
    detail: function (el) {
      el.innerHTML = '<div class="dn-img" style="background-image:url(&quot;' + TV.esc(photo.url) + '&quot;)"></div>' +
        '<div class="dn-caption"><div class="dn-title">' + TV.esc(photo.title) + '</div>' +
        (photo.credit ? '<div class="nasa-credit">© ' + TV.esc(photo.credit) + '</div>' : '') +
        (photo.explanation ? '<div class="dn-text">' + TV.esc(photo.explanation) + '</div>' : '') +
        '<button class="btn" data-focus data-action="set-bg">Use as Background</button></div>';
    },
    detailAction: function (action) {
      if (action === 'set-bg') { TV.handleThemeAction('nasa', 'nasa'); TV.closeSheet(); }
    }
  });
})(window.TV);
