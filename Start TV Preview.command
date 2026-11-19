#!/bin/bash
# Double-click this on your Mac to see the dashboard on your TV right now, with nothing to install on the TV.
# It starts a small web server on your Mac (tools/serve.py, which also fetches your iCloud calendar for the page); you open the address it prints in the TV's Internet (browser) app.
# Limits: the Mac has to stay on, the TV browser shows its own bars, and apps cannot be opened from a browser
# (that part needs the real install, see README). Use it on your home Wi-Fi only: anyone on the same network
# could read the files, including config.local.js.
cd "$(dirname "$0")"
PORT=8765
IP=$(ipconfig getifaddr en0 2>/dev/null)
[ -z "$IP" ] && IP=$(ipconfig getifaddr en1 2>/dev/null)
if ! command -v python3 >/dev/null 2>&1; then
  echo "This needs python3. macOS offers to install it (Command Line Tools) the first time you type: python3"
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi
echo
echo "  On your TV, open the Internet (browser) app and go to:"
echo
if [ -n "$IP" ]; then echo "      http://$IP:$PORT/index.html"; else echo "      http://YOUR-MAC-IP:$PORT/index.html   (find the IP in System Settings > Wi-Fi > Details)"; fi
echo
echo "  Want to see it with sample data instead of your own? Add ?demo=1 at the end."
echo "  Keep this window open. Close it (or press Control-C) to stop."
echo
python3 tools/serve.py $PORT
