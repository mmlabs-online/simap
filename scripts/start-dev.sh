#!/usr/bin/env bash
# One-command local start on production data (SIM-032): hands off to scripts/dev-prod.mjs, which does every check.
# The wrapper reads and handles no secret; the launcher's hidden prompts need a real Node TTY (winpty under Git Bash).
set -eu
cd "$(dirname "$0")/.."
fail() { echo "start-dev: $*" >&2; exit 1; }
command -v node >/dev/null 2>&1 || fail "node not found (install Node 22)."
if env -u NODE_OPTIONS node -e 'process.exit(process.stdin.isTTY && process.stdout.isTTY ? 0 : 1)'; then
  exec node scripts/dev-prod.mjs "$@"
fi
case "$(uname -s)" in
  MINGW*|MSYS*|CYGWIN*)
    if [ -t 0 ] && [ -t 1 ] && command -v winpty >/dev/null 2>&1; then
      node_exe="$(env -u NODE_OPTIONS node -p process.execPath)"
      exec winpty "$node_exe" scripts/dev-prod.mjs "$@"
    fi ;;
esac
fail "needs an interactive terminal: use PowerShell, Windows Terminal, macOS Terminal, or Git Bash with winpty."
