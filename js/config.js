// Default settings. Do not put your private info here —
// copy config.local.example.js to config.local.js and edit that instead.
window.TV_CONFIG = {
  // iCloud public calendar links: [{ url: 'webcal://p..-caldav.icloud.com/published/2/...', name: 'Home', color: '#ff9500' }]
  calendars: [],
  // How many days ahead the "Up Next" list looks.
  calendarDays: 7,

  // Optional CORS proxy for the calendar (see proxy/README.md). Example: 'https://cal-proxy.yourname.workers.dev/?url='
  corsProxy: '',

  // Location. Leave lat/lon empty to detect it automatically from your internet connection.
  location: { name: '', lat: null, lon: null },

  // Guest Wi-Fi QR code. Leave ssid empty to hide the widget.
  wifi: { ssid: '', password: '', security: 'WPA', hidden: false },

  // Birthdays not in your calendar. date is 'MM-DD'.
  birthdays: [],
  // Country for public holidays (2-letter code).
  holidayCountry: 'US',

  // Commute time (needs a free Mapbox token).
  commute: {
    mapboxToken: '',
    from: '', // home address, or 'lat,lon'
    to: '',   // work address, or 'lat,lon'
    label: 'Work',
    showFrom: '06:00',
    showUntil: '10:00'
  },

  // NASA Astronomy Picture of the Day. Get a free key at https://api.nasa.gov
  nasaApiKey: 'DEMO_KEY',

  // Spotify Now Playing. Run tools/spotify-login.mjs on your Mac to fill these in.
  spotify: { clientId: '', refreshToken: '' },

  // Your own wallpaper photos: put the files in images/wallpapers/ and list the file names here.
  wallpapers: [],

  // Widgets that start turned off (you can turn them back on in Settings on the TV).
  // Names: 'sunmoon', 'wifi', 'dates', 'commute', 'nasa', 'spotify', 'alerts'
  widgetsOff: []
};
