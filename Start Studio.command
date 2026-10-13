#!/bin/bash
# macOS: double-click to set up (first time) and open Claude Nine Studio in your browser.
cd "$(dirname "$0")" || exit 1
if ! command -v node >/dev/null 2>&1; then
  if command -v brew >/dev/null 2>&1; then
    echo "Installing Node.js with Homebrew..."; brew install node || exit 1
  else
    echo "Node.js is needed. Opening nodejs.org: install the LTS version, then double-click this file again."
    open "https://nodejs.org/en/download"; read -r -p "Press Enter to close."; exit 1
  fi
fi
node studio/setup.mjs || { read -r -p "Setup failed (see above). Press Enter to close."; exit 1; }
node studio/server.mjs --open
