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

  // Countdowns (or make a calendar event titled "Countdown: Beach trip" from your phone).
  // c.countdowns = [{ name: 'Beach trip', date: '2026-12-20' }, { name: 'Anniversary', date: '06-14' }];

  // Your own wallpaper photos (put the files in images/wallpapers/). With two or more you get a Slideshow
  // on the theme screen, and Ambient Mode shows them as a photo frame.
  // c.wallpapers = ['beach.jpg', 'mountains.jpg'];

  // Widgets that start turned off: 'sunmoon', 'wifi', 'dates', 'commute', 'nasa', 'air', 'countdown', 'spotify'
  // c.widgetsOff = ['dates', 'nasa'];
})(window.TV_CONFIG);
