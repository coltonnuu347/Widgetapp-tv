# Optional calendar proxy

You only need this if your calendar shows **"Couldn't load … (Failed to fetch)"** on the TV
while weather and everything else work. That means the TV is blocking the cross-site request to
iCloud (a CORS error). This small Cloudflare Worker fetches the calendar for the TV.

It's free on Cloudflare's free plan, and it only forwards requests to `icloud.com`.

## Set it up (about 5 minutes)

1. Create a free account at https://dash.cloudflare.com.
2. Go to **Workers & Pages** → **Create** → **Create Worker**. Name it something like `cal-proxy`, then click **Deploy**.
3. Click **Edit code**, delete what's there, paste in everything from `worker.js`, and click **Deploy**.
4. Copy the worker's address, e.g. `https://cal-proxy.yourname.workers.dev`.
5. In `config.local.js`, add this line (the `/?url=` on the end matters):

   ```js
   c.corsProxy = 'https://cal-proxy.yourname.workers.dev/?url=';
   ```

6. Rebuild and reinstall the app on the TV.

Privacy note: your calendar link passes through your own Worker. Nobody else can see it, but
anyone who has the link can read that calendar, so keep it private.
