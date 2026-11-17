#!/usr/bin/env node
// One-time Spotify sign-in for the TV dashboard. Run on your Mac:
//   node tools/spotify-login.mjs YOUR_SPOTIFY_CLIENT_ID
// It opens Spotify's sign-in page, then writes spotify.local.js next to index.html.
// Needs Node 18 or newer. Uses the PKCE flow, so no client secret is stored anywhere.

import http from 'node:http';
import crypto from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { exec } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const clientId = process.argv[2];
if (!clientId) {
  console.error('Usage: node tools/spotify-login.mjs YOUR_SPOTIFY_CLIENT_ID');
  process.exit(1);
}

const PORT = 8888;
const REDIRECT_URI = `http://127.0.0.1:${PORT}/callback`;
const SCOPES = 'user-read-playback-state user-modify-playback-state user-read-currently-playing';
const OUT_FILE = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'spotify.local.js');

const base64url = (buf) => buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
const verifier = base64url(crypto.randomBytes(64));
const challenge = base64url(crypto.createHash('sha256').update(verifier).digest());
const state = base64url(crypto.randomBytes(16));

const authUrl = 'https://accounts.spotify.com/authorize?' + new URLSearchParams({
  client_id: clientId,
  response_type: 'code',
  redirect_uri: REDIRECT_URI,
  code_challenge_method: 'S256',
  code_challenge: challenge,
  scope: SCOPES,
  state
});

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://127.0.0.1:${PORT}`);
  if (url.pathname !== '/callback') { res.writeHead(404); res.end(); return; }

  const finish = (status, msg) => {
    res.writeHead(status, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(`<body style="font:20px -apple-system,sans-serif;padding:40px">${msg}</body>`);
  };

  if (url.searchParams.get('state') !== state) return finish(400, 'Sign-in failed: state did not match. Run the tool again.');
  if (url.searchParams.get('error')) return finish(400, 'Sign-in was cancelled: ' + url.searchParams.get('error'));

  try {
    const tokenRes = await fetch('https://accounts.spotify.com/api/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code: url.searchParams.get('code'),
        redirect_uri: REDIRECT_URI,
        client_id: clientId,
        code_verifier: verifier
      })
    });
    const json = await tokenRes.json();
    if (!tokenRes.ok || !json.refresh_token) throw new Error(JSON.stringify(json));

    await writeFile(OUT_FILE,
      '// Written by tools/spotify-login.mjs. Keep this file private.\n' +
      `window.TV_CONFIG.spotify = { clientId: ${JSON.stringify(clientId)}, refreshToken: ${JSON.stringify(json.refresh_token)} };\n`);
    finish(200, '✅ Spotify is connected. You can close this tab and rebuild/install the TV app.');
    console.log('\nSaved ' + OUT_FILE);
    console.log('Now rebuild and install the app on your TV.');
  } catch (e) {
    finish(500, 'Could not finish sign-in. See the Terminal for details.');
    console.error('Token exchange failed:', e.message);
  } finally {
    setTimeout(() => server.close(), 500);
  }
});

server.listen(PORT, '127.0.0.1', () => {
  console.log('Opening Spotify sign-in in your browser…');
  console.log('If it does not open, paste this link into your browser:\n\n' + authUrl + '\n');
  const opener = process.platform === 'darwin' ? 'open' : process.platform === 'win32' ? 'start ""' : 'xdg-open';
  exec(`${opener} "${authUrl}"`);
});
