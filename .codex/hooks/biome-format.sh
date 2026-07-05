#!/usr/bin/env bash
# PostToolUse(Edit|Write|MultiEdit): auto-format the edited file with Biome so
# every change matches the repo's max-strict style before it's committed.
#
# Reads the hook JSON on stdin, pulls tool_input.file_path, and formats only
# files Biome actually governs — TS/JS/JSON under the repo, skipping the native
# dirs Biome excludes (apps/mobile/targets, apps/mobile/modules) and the
# generated golden vectors. Always exits 0: formatting must never block a tool.
set -uo pipefail

input="$(cat)"
file="$(printf '%s' "$input" | python3 -c 'import sys,json; print(json.load(sys.stdin).get("tool_input",{}).get("file_path",""))' 2>/dev/null || true)"
[ -z "$file" ] && exit 0

case "$file" in
  *.ts|*.tsx|*.js|*.jsx|*.mjs|*.cjs|*.json|*.jsonc) ;;
  *) exit 0 ;;
esac

# Respect Biome's own excludes (see biome.json): native targets/modules + the
# generated vectors are not formatted by the repo config.
case "$file" in
  */apps/mobile/targets/*|*/apps/mobile/modules/*|*/vectors/golden.json) exit 0 ;;
esac

[ -f "$file" ] || exit 0
cd "${CLAUDE_PROJECT_DIR:-.}" || exit 0
pnpm exec biome check --write "$file" >/dev/null 2>&1 || true
exit 0
