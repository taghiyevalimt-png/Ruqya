#!/usr/bin/env bash
# Restore a nightly backup (made by .github/workflows/backup.yml) into a NEW, EMPTY Supabase database.
# See docs/BACKUP.md. Needs: gpg, tar, sha256sum, psql 17 (PGDG postgresql-client-17); for "local" also Docker and
# the Supabase CLI (npx supabase@3.1.0 works).
#
#   1) scripts/restore.sh decrypt ruqya-backup-<UTC>.tar.gpg [DIR]
#        checks the .sha256 file next to the archive, asks for the passphrase, unpacks into DIR (default: a new
#        folder next to the archive, readable only by you).
#   2a) scripts/restore.sh local DIR
#        self-hosted test copy: "supabase init" + "supabase start" in DIR/stack (Docker), then restore into it.
#   2b) scripts/restore.sh target DIR "postgresql://..."
#        any other empty Supabase database: a new supabase.com project (Dashboard > Connect > Session pooler URI),
#        or a self-hosted docker-compose stack from github.com/supabase/supabase/tree/master/docker
#        (postgresql://postgres.<POOLER_TENANT_ID>:<POSTGRES_PASSWORD>@<host>:5432/postgres, see its .env).
#   Both 2a and 2b: roles, schema, privileges and realtime membership, then data with triggers off, all in one
#   transaction (Supabase's documented order), then the row counts and hashes are compared with the backup's
#   manifest-source.txt and the structure with manifest-structure-source.txt.
#
# The restore refuses to run against the live project or a database whose public schema already has tables.
set -euo pipefail

LIVE_REF=ldkhdeehrrajvgrtieal
SUPABASE_CLI_VERSION=${SUPABASE_CLI_VERSION:-3.1.0}
MIN_PG=${MIN_PG:-17}   # the backup comes from PostgreSQL 17 (lower only for tests)
here=$(cd "$(dirname "$0")" && pwd)

die() { echo "restore: $*" >&2; exit 1; }
need() { command -v "$1" >/dev/null 2>&1 || die "$1 is not installed"; }
usage() { sed -n '2,22p' "$0"; exit 2; }

check_psql() {
  need psql
  local v; v=$(psql --version | sed -E 's/[^0-9]*([0-9]+).*/\1/')
  [ "$v" -ge "$MIN_PG" ] || die "psql $v found; install postgresql-client-17 (PGDG) - the backup comes from PostgreSQL 17"
}

decrypt() {
  local arc=$1 dir=${2:-}
  need gpg; need tar; need sha256sum
  [ -f "$arc" ] || die "no such file: $arc"
  if [ -f "$arc.sha256" ]; then
    (cd "$(dirname "$arc")" && sha256sum -c "$(basename "$arc").sha256") || die "checksum does not match: the archive is damaged or not the one that was made"
  else
    echo "warning: $arc.sha256 not found, checksum not verified" >&2
  fi
  [ -n "$dir" ] || dir="${arc%.tar.gpg}"
  [ ! -e "$dir" ] || [ -z "$(ls -A "$dir")" ] || die "$dir exists and is not empty"
  umask 077; mkdir -p "$dir"
  # gpg asks for the passphrase itself (or reads it from BACKUP_PASSPHRASE when set, never from the command line)
  if [ -n "${BACKUP_PASSPHRASE:-}" ]; then
    printf '%s' "$BACKUP_PASSPHRASE" | gpg --batch --quiet --pinentry-mode loopback --passphrase-fd 0 --decrypt "$arc" | tar -xf - -C "$dir"
  else
    gpg --quiet --decrypt "$arc" | tar -xf - -C "$dir"
  fi
  for f in roles.sql schema.sql data.sql manifest-source.txt manifest-query.sql; do [ -f "$dir/$f" ] || die "$f missing in the archive"; done
  echo "Unpacked into $dir (contains personal data and password hashes: keep it private, delete it when done)."
  ls -la "$dir"
}

restore_into() {
  local dir=$1 db=$2
  check_psql
  for f in roles.sql schema.sql data.sql manifest-source.txt manifest-query.sql; do [ -f "$dir/$f" ] || die "$dir/$f missing (run: $0 decrypt ... first)"; done
  case "$db" in *"$LIVE_REF"*) die "this is the live project; restore only into a new, empty project";; esac
  local n; n=$(psql "$db" -X -At -v ON_ERROR_STOP=1 -c "select count(*) from pg_class c join pg_namespace s on s.oid=c.relnamespace where s.nspname='public' and c.relkind in ('r','p')") \
    || die "cannot connect to the target database"
  [ "$n" = 0 ] || die "the target already has $n tables in schema public; use a new, empty project"
  local v; v=$(psql "$db" -X -At -c 'show server_version_num')
  [ "$v" -ge "${MIN_PG}0000" ] || die "the target runs PostgreSQL $v; use PostgreSQL 17 or newer"
  local post=()
  if [ -f "$dir/post-schema.sql" ]; then post=(--file post-schema.sql); else echo "warning: no post-schema.sql in this backup; check privileges by hand" >&2; fi
  echo "Restoring roles, schema, privileges and data in one transaction..."
  ( cd "$dir" && psql "$db" -X -q --single-transaction -v ON_ERROR_STOP=1 -v VERBOSITY=terse \
      --file roles.sql --file schema.sql "${post[@]}" \
      --command 'SET session_replication_role = replica' --file data.sql ) > "$dir/restore.log" 2>&1 || {
    grep -m5 ERROR "$dir/restore.log" | sed -E "s/\"[^\"]*\"/\"…\"/g; s/'[^']*'/'…'/g" | cut -c1-300 >&2
    die "restore failed and was rolled back (full log with details: $dir/restore.log)"; }
  echo "Comparing with the backup's manifest..."
  psql "$db" -X -q -At -F $'\t' -v ON_ERROR_STOP=1 -f "$dir/manifest-query.sql" > "$dir/manifest-check.txt"
  local ok=1
  diff "$dir/manifest-source.txt" "$dir/manifest-check.txt" || { echo "row counts / hashes differ" >&2; ok=0; }
  if [ -f "$dir/manifest-structure-source.txt" ]; then
    psql "$db" -X -q -At -F $'\t' -v ON_ERROR_STOP=1 -f "$here/backup-structure.sql" > "$dir/manifest-structure-check.txt"
    diff "$dir/manifest-structure-source.txt" "$dir/manifest-structure-check.txt" || { echo "structure differs" >&2; ok=0; }
  fi
  [ "$ok" = 1 ] || die "the restored copy does not match the backup"
  echo "OK: $(wc -l < "$dir/manifest-source.txt") tables restored, counts, hashes and structure equal to the backup."
  cat <<'EOF'

Next steps (not in the database, do them by hand on the new project):
  - Authentication > Sign In / Providers: switch off "Allow new users to sign up" and anonymous sign-ins, as before.
  - Authentication > URL Configuration: Site URL of the app.
  - The sign-in accounts and their passwords came back with the data; everybody signs in again once
    (the new project has its own JWT secret, old sessions are not valid there).
  - Point the app at the new project: put SUPABASE_URL and SUPABASE_ANON_KEY (Project Settings > API, the
    publishable / anon key, never the secret key) in .env and run
        python3 tools/configure.py /tmp/site
    then publish that copy (copy its index.html over the repository's and push, or host the folder elsewhere).
    The Android app opens the GitHub Pages site, so it follows automatically.
EOF
}

local_stack() {
  local dir=$1
  need docker
  local sb=(npx --yes "supabase@$SUPABASE_CLI_VERSION")
  command -v supabase >/dev/null 2>&1 && [ "$(supabase --version 2>/dev/null | tail -1)" = "$SUPABASE_CLI_VERSION" ] && sb=(supabase)
  mkdir -p "$dir/stack"
  ( cd "$dir/stack"
    [ -f supabase/config.toml ] || "${sb[@]}" init < /dev/null
    sed -i.bak 's/^major_version = .*/major_version = 17/' supabase/config.toml
    "${sb[@]}" start
    "${sb[@]}" status -o env > status.env 2>/dev/null )
  local db; db=$(sed -n 's/^DB_URL=//p' "$dir/stack/status.env" | head -1 | sed 's/^"\(.*\)"$/\1/')
  [ -n "$db" ] || die "could not read the local database URL from supabase status"
  restore_into "$dir" "$db"
  local api; api=$(sed -n 's/^API_URL=//p' "$dir/stack/status.env" | head -1 | sed 's/^"\(.*\)"$/\1/')
  echo
  echo "Local stack: $api (Studio: supabase status). Stop it with: (cd $dir/stack && ${sb[*]} stop --no-backup)"
  echo "App on it: SUPABASE_URL=$api SUPABASE_ANON_KEY=<ANON_KEY from $dir/stack/status.env> python3 tools/configure.py /tmp/site"
}

[ $# -ge 1 ] || usage
cmd=$1; shift
case "$cmd" in
  decrypt) [ $# -ge 1 ] || usage; decrypt "$@";;
  local)   [ $# -eq 1 ] || usage; local_stack "$1";;
  target)  [ $# -eq 2 ] || usage; restore_into "$1" "$2";;
  *) usage;;
esac
