#!/bin/bash
# Double-clicking this file in Finder runs it in a Terminal window — that's
# the whole "setup": no typing commands needed.
cd "$(dirname "$0")" || exit 1

if ! command -v node >/dev/null 2>&1; then
  echo "Node.js isn't installed on this Mac yet — it's needed to run this."
  echo "Opening the download page for you. Install it, then double-click this file again."
  open "https://nodejs.org"
  read -n 1 -s -r -p "Press any key to close this window..."
  exit 1
fi

if [ ! -d node_modules ]; then
  echo "First-time setup — this takes a minute, just this once."
  # Uses your already-installed Chrome/Edge instead of downloading a browser.
  PUPPETEER_SKIP_DOWNLOAD=true npm install
  if [ ! -d node_modules ]; then
    echo "Setup failed — see the error above. Try again, or ask for help."
    read -n 1 -s -r -p "Press any key to close this window..."
    exit 1
  fi
fi

npm start

echo
read -n 1 -s -r -p "Press any key to close this window..."
