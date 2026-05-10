#!/bin/bash
#
# Build and deploy conscott.info to the webnode.
# Pass --dry-run / -n to preview the rsync diff without making changes.
#
set -euo pipefail

DRY_RUN=""
if [[ "${1:-}" == "--dry-run" || "${1:-}" == "-n" ]]; then
  DRY_RUN="--dry-run"
  echo "DRY RUN — nothing will be uploaded or deleted"
fi

rm -rf _site
bundle exec jekyll build

rm -rf _site/assets   # auto-generated default-theme CSS we don't reference
rm -f  _site/CNAME    # GitHub Pages convention; meaningless on the webnode

rsync -avz --delete --human-readable $DRY_RUN \
  _site/ root@webnode:/var/www/conscott.info/

if [[ -z "$DRY_RUN" ]]; then
  echo "Deployed to https://conscott.info/"
fi
