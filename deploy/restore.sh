#!/usr/bin/env bash
set -euo pipefail
umask 077
: "${PGDATABASE:?Set PGDATABASE to an empty recovery database.}"
: "${RESTORE_TARGET:?Set RESTORE_TARGET to the same recovery database name.}"
[[ "$PGDATABASE" = "$RESTORE_TARGET" ]] || { echo 'Recovery target mismatch.' >&2; exit 1; }
archive="${1:?Usage: bash deploy/restore.sh /absolute/path/backup.dump}"
[[ -f "$archive" && -f "$archive.sha256" ]] || { echo 'Archive and checksum required.' >&2; exit 1; }
read -r expected_hash _ < "$archive.sha256"
actual_hash="$(sha256sum "$archive")"
[[ "$expected_hash" =~ ^[0-9a-f]{64}$ && "$expected_hash" = "${actual_hash%% *}" ]] || { echo 'Backup checksum mismatch.' >&2; exit 1; }
objects="$(psql -X -v ON_ERROR_STOP=1 -Atc "SELECT count(*) FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace WHERE n.nspname NOT IN ('pg_catalog','information_schema') AND n.nspname NOT LIKE 'pg_toast%' AND c.relkind IN ('r','p','v','m','S','f')")"
[[ "$objects" = 0 ]] || { echo 'Refusing to restore over a nonempty database.' >&2; exit 1; }
# Never --clean or --create: recovery happens in a separately provisioned empty database.
pg_restore --exit-on-error --single-transaction --no-owner --no-privileges --dbname="$PGDATABASE" "$archive"
echo 'Restore complete. Keep workers and live providers disabled until reconciliation and sign-off.'
