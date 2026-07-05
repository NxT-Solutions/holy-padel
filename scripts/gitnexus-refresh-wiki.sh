#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT_DIR"

GITNEXUS_NODE="${GITNEXUS_NODE:-node}"
GITNEXUS_RUNNER="${GITNEXUS_RUNNER:-.gitnexus/run.cjs}"
WIKI_SOURCE="${GITNEXUS_WIKI_SOURCE:-.gitnexus/wiki}"
WIKI_TARGET="${GITNEXUS_WIKI_TARGET:-docs/gitnexus-wiki}"

PROVIDER="${GITNEXUS_WIKI_PROVIDER:-codex}"
CONCURRENCY="${GITNEXUS_WIKI_CONCURRENCY:-1}"
TIMEOUT="${GITNEXUS_WIKI_TIMEOUT:-300}"
RETRIES="${GITNEXUS_WIKI_RETRIES:-1}"

if [[ ! -f "$GITNEXUS_RUNNER" ]]; then
  echo "Missing $GITNEXUS_RUNNER. Run GitNexus setup/analyze first." >&2
  exit 1
fi

echo "Refreshing GitNexus index..."
analyze_args=(analyze)
if [[ "${GITNEXUS_ANALYZE_FORCE:-0}" == "1" ]]; then
  analyze_args+=(--force)
fi
"$GITNEXUS_NODE" "$GITNEXUS_RUNNER" "${analyze_args[@]}"

if [[ "${GITNEXUS_WIKI_SKIP_GENERATE:-0}" != "1" ]]; then
  wiki_args=(
    wiki
    --force
    --provider "$PROVIDER"
    --concurrency "$CONCURRENCY"
    --timeout "$TIMEOUT"
    --retries "$RETRIES"
  )

  if [[ -n "${GITNEXUS_WIKI_MODEL:-}" ]]; then
    wiki_args+=(--model "$GITNEXUS_WIKI_MODEL")
  fi

  if [[ -n "${GITNEXUS_WIKI_BASE_URL:-}" ]]; then
    wiki_args+=(--base-url "$GITNEXUS_WIKI_BASE_URL")
  fi

  echo "Generating GitNexus wiki with provider=$PROVIDER..."
  "$GITNEXUS_NODE" "$GITNEXUS_RUNNER" "${wiki_args[@]}"
else
  echo "Skipping wiki generation; syncing existing $WIKI_SOURCE."
fi

if [[ ! -d "$WIKI_SOURCE" ]]; then
  echo "Missing generated wiki directory: $WIKI_SOURCE" >&2
  exit 1
fi

echo "Syncing generated wiki to $WIKI_TARGET..."
rm -rf "$WIKI_TARGET"
mkdir -p "$WIKI_TARGET"
rsync -a "$WIKI_SOURCE"/ "$WIKI_TARGET"/
find "$WIKI_TARGET" -maxdepth 1 -type f -name '*.md' -print0 \
  | xargs -0 perl -0pi -e 's/\A(# [^\n]+\n)\n\1/$1\n/; s/\A(# [^\n]+\n)\n{2,}/$1\n/'
if [[ -f "$WIKI_TARGET/first_module_tree.json" ]]; then
  "$GITNEXUS_NODE" -e 'const fs = require("node:fs"); const file = process.argv[1]; fs.writeFileSync(file, `${JSON.stringify(JSON.parse(fs.readFileSync(file, "utf8")), null, 2)}\n`);' "$WIKI_TARGET/first_module_tree.json"
fi

{
  echo "# GitNexus Wiki"
  echo
  echo "Generated from the local GitNexus index. Rebuild with:"
  echo
  echo '```sh'
  echo "pnpm gitnexus:wiki"
  echo '```'
  echo
  echo "To sync an already-generated .gitnexus/wiki directory without invoking an LLM:"
  echo
  echo '```sh'
  echo "GITNEXUS_WIKI_SKIP_GENERATE=1 pnpm gitnexus:wiki"
  echo '```'
  echo
  echo "## Pages"
  echo
  find "$WIKI_TARGET" -maxdepth 1 -type f -name '*.md' ! -name 'README.md' \
    | sort \
    | while read -r file; do
        name="$(basename "$file" .md)"
        title="$(head -n 1 "$file" | sed 's/^# //')"
        if [[ -z "$title" ]]; then
          title="$name"
        fi
        echo "- [$title]($name.md)"
      done
} > "$WIKI_TARGET/README.md"

echo "Writing GitNexus status and graph check snapshots..."
"$GITNEXUS_NODE" "$GITNEXUS_RUNNER" status > "$WIKI_TARGET/gitnexus-status.txt"
if ! "$GITNEXUS_NODE" "$GITNEXUS_RUNNER" check --cycles --json > "$WIKI_TARGET/gitnexus-check.json"; then
  echo "GitNexus graph check reported findings; see $WIKI_TARGET/gitnexus-check.json."
fi
"$GITNEXUS_NODE" -e 'const fs = require("node:fs"); const file = process.argv[1]; fs.writeFileSync(file, `${JSON.stringify(JSON.parse(fs.readFileSync(file, "utf8")), null, 2)}\n`);' "$WIKI_TARGET/gitnexus-check.json"
if command -v pnpm >/dev/null 2>&1; then
  pnpm exec biome check --write "$WIKI_TARGET/first_module_tree.json" "$WIKI_TARGET/gitnexus-check.json" >/dev/null || true
fi

echo "GitNexus wiki refreshed in $WIKI_TARGET."
