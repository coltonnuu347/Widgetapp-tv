// Copy this file to config.local.js and edit it. It is loaded after js/config.js and overrides it.
// config.local.js is ignored by git: it holds your private links, addresses and tokens.
(function (c) {
  // iCloud public calendar link(s): Calendar app > right-click a calendar > Share Calendar > Public Calendar.
  c.calendars = [
    // { url: 'webcal://p00-caldav.icloud.com/published/2/YOUR_LINK', name: 'Home', color: '#ff9500' }
  ];

  // Weather location. Leave out to detect it from your internet connection.
  // c.location = { name: 'Your Town', region: 'ST', country: 'US', lat: 0.0, lon: 0.0 };

  // Guest Wi-Fi QR code widget.
  // c.wifi = { ssid: 'MyGuestWiFi', password: 'secret123', security: 'WPA', hidden: false };

  // Birthdays that are not in your calendar (date is 'MM-DD').
  // c.birthdays = [{ name: 'Mom', date: '05-14' }];

  // Commute widget (free Mapbox token: https://account.mapbox.com).
  // c.commute.mapboxToken = 'pk.YOUR_TOKEN';
  // c.commute.from = 'Home address';
  // c.commute.to = 'Work address';

  // NASA Picture of the Day (free key: https://api.nasa.gov).
  // c.nasaApiKey = 'YOUR_NASA_KEY';

  // Your own wallpaper photos (put the files in images/wallpapers/).
  // c.wallpapers = ['beach.jpg', 'mountains.jpg'];

  // Widgets that start turned off: 'sunmoon', 'wifi', 'dates', 'commute', 'nasa', 'spotify'
  // c.widgetsOff = ['dates', 'nasa'];
})(window.TV_CONFIG);
