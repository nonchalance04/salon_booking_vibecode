#!/usr/bin/env bash
set -euo pipefail
umask 077
project_dir="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")/.." && pwd)"
archive="${1:?Usage: bash deploy/package-release.sh /absolute/path/release.tgz}"
[[ "$archive" = /* && ! -e "$archive" ]] || { echo 'Use a new absolute output path.' >&2; exit 1; }
[[ "$(node -p 'process.versions.node.split(".")[0]')" = 24 ]] || { echo 'Node 24 is required.' >&2; exit 1; }
cd "$project_dir/backend"
npm run build
cd "$project_dir/frontend"
npm run build
cd "$project_dir"
# Explicit allowlist includes uncommitted implementation files, never .env or node_modules.
tar -czf "$archive" backend/dist backend/package.json backend/package-lock.json \
  backend/prisma/schema.prisma backend/prisma/migrations backend/prisma7.config.ts \
  frontend/dist deploy docs README.md .nvmrc
sha256sum "$archive" > "$archive.sha256"
echo "Release packaged: $archive"
