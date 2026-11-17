#!/bin/bash
# Double-click this on your Mac to connect Spotify to the TV Dashboard (one time only).
# Needs Node.js (https://nodejs.org) and Spotify Premium.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed. Get it from https://nodejs.org, then double-click this file again."
  read -n 1 -s -r -p "Press any key to close."
  exit 1
fi
read -r -p "Paste your Spotify Client ID: " CLIENT_ID
node tools/spotify-login.mjs "$CLIENT_ID"
read -n 1 -s -r -p "Press any key to close."
