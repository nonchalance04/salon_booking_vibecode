#!/usr/bin/env bash
set -euo pipefail
umask 077
# Use libpq PGHOST/PGPORT/PGUSER/PGDATABASE and a mode-0600 PGPASSFILE.
# Avoid putting production passwords in command-line arguments or shell history.
: "${PGDATABASE:?Set PGDATABASE for the source database.}"
archive="${1:?Usage: bash deploy/backup.sh /absolute/path/new-backup.dump}"
[[ "$archive" = /* && ! -e "$archive" ]] || { echo 'Use a new absolute output path.' >&2; exit 1; }
pg_dump --format=custom --file="$archive"
pg_restore --list "$archive" > /dev/null
sha256sum "$archive" > "$archive.sha256"
echo 'Backup and checksum written. Copy to protected off-host storage and verify restoration.'
