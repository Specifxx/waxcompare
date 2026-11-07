#!/usr/bin/env bash
# Commits data/public/ (just written by scripts/export-public-data.ts) to main and pushes it. With the second
# argument "release", that commit is what puts the new prices live: its subject carries [deploy], so Vercel builds it
# (scripts/vercel-ignore-build.sh) and the build bundles the files the site reads. Without it (the eBay import) the commit rides the
# next release, which carries the newest snapshot anyway: production builds once per sealed import, twice a day, not once per
# workflow (DEPLOY.md, "Where the data lives"). Run from the repository root, in a checkout of main,
# after the export.
#
# Another workflow may have pushed meanwhile (the sealed and eBay imports both publish): on a rejected push the fresh files are set
# aside, main is fetched again, the files go back on top and the push is retried. A snapshot is a whole-database export, so the
# latest one simply wins.
set -euo pipefail
DIR="data/public"
WHY="${1:-export}"
MARK=""
[ "${2:-}" = "release" ] && MARK=" [deploy]"
git config user.name "waxcompare-data[bot]"
git config user.email "waxcompare-data@users.noreply.github.com"
# Everything a data job writes rides ONE commit: the public tables, the release list (scripts/discover-sets.ts), Amazon ASINs
# (scripts/amazon-asins.ts: ASINs and the run's status, never prices) and the eBay call counter (data/state/ebay-calls.json, so the
# next job's fresh database still knows today's spend).
DIRS=("$DIR" "data/sets" "data/amazon" "data/state")
if git diff --quiet -- "${DIRS[@]}" && [ -z "$(git ls-files --others --exclude-standard -- "${DIRS[@]}")" ]; then
  echo "[publish] nothing changed — nothing to commit."
  exit 0
fi
# Each directory is set aside whole, so a rejected push can go back on top of a fresh main without losing any of them.
STASH="$(mktemp -d)"
for d in "${DIRS[@]}"; do
  if [ -d "$d" ]; then mkdir -p "$STASH/$d"; cp -r "$d/." "$STASH/$d/"; fi
done
for attempt in 1 2 3 4 5; do
  git fetch -q origin main
  git reset -q --hard origin/main
  rm -f "$DIR"/*.json
  for d in "${DIRS[@]}"; do
    if [ -d "$STASH/$d" ]; then mkdir -p "$d"; cp -r "$STASH/$d/." "$d/"; fi
  done
  git add -A -- "${DIRS[@]}"
  if git diff --cached --quiet; then
    echo "[publish] main already has this snapshot."
    exit 0
  fi
  git commit -q -m "WaxCompare data: $(date -u +%Y-%m-%dT%H:%MZ) ($WHY)$MARK" -m "Public data export (data/public/), the files the site reads. WaxCompare has no hosted database."
  if git push -q origin HEAD:main; then
    echo "[publish] pushed $(git rev-parse --short HEAD) on attempt $attempt."
    exit 0
  fi
  sleep $((attempt * 5))
done
echo "[publish] could not push after 5 attempts." >&2
exit 1
