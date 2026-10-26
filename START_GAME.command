#!/bin/zsh
cd -- "$(dirname -- "$0")" || exit 1
if command -v python3 >/dev/null 2>&1; then
  exec python3 scripts/serve.py
fi
printf 'Python 3 is required. Alternatively, with Node 20+, run: npm start\n'
read -r '?Press Return to close.'
