# Database backup

## What is backed up
Every night `.github/workflows/backup.yml` copies the whole Supabase database the way Supabase documents for moving
a project:

| file in the archive | contents |
|---|---|
| `roles.sql` | database roles (`supabase db dump --role-only`) |
| `schema.sql` | tables, functions, triggers, row-level security policies, grants (`supabase db dump`) |
| `post-schema.sql` | the exact privileges and realtime membership of schema `public`, applied after `schema.sql` (a new project's default privileges would otherwise widen access, e.g. make `readers.price` readable) |
| `data.sql` | all rows, including the sign-in accounts `auth.users` (with password hashes) and `auth.identities` (`supabase db dump --data-only --use-copy`) |
| `public-auth-storage.dump` | a second, standard `pg_dump -Fc` copy of schemas `public`, `auth`, `storage` (for `pg_restore`) |
| `manifest-*.txt`, `manifest-query.sql` | row count and content hash (md5) per table, structure fingerprints; no personal data |

Not in the database and so not in the backup: Authentication settings (sign-ups off, Site URL, e-mail templates),
API keys and the JWT secret, the app code (that is in this repository). There are no Storage files and no Edge
Functions.

Each night the job also proves the copy works: it restores it into a fresh Supabase stack on the GitHub runner
(not connected to the live project), checks that every table's count and hash equal the live database's and that
the structure is identical, and opens the app on the copy with a temporary admin, which must see every appointment.
If anything differs the job fails (GitHub e-mails the person who last changed the schedule in the workflow file; check the Actions tab now and then).

## Schedule, retention, RPO
- Daily at 23:17 UTC (03:17 in Baku); also by hand: Actions > Database backup > Run workflow.
- Kept 35 days as a GitHub Actions artifact `ruqya-backup-<UTC time>`: `ruqya-backup-<UTC>.tar.gpg` (AES-256,
  passphrase), `.sha256`, and the manifests.
- **Recovery point objective: 24 hours.** At most one day of changes can be lost.
- **The owner must copy each week's archive to two places outside GitHub** (for example an external disk and a
  personal cloud drive). GitHub artifacts disappear after 35 days, and with the GitHub account or repository.
- The passphrase (`BACKUP_PASSPHRASE` secret) must also be kept outside GitHub (a password manager, plus a sealed
  paper copy). Without it no backup can be opened; GitHub never shows a secret again.

## Set up (once)
Repository > Settings > Secrets and variables > Actions > New repository secret:
- `SUPABASE_DB_URL`: Supabase Dashboard > Connect > **Session pooler** connection string with the database password.
- `BACKUP_PASSPHRASE`: a long random passphrase (at least 20 characters), e.g. `openssl rand -base64 32`.

## Verify and decrypt
Download the artifact (Actions > the run > Artifacts) and unzip it, then:

    sha256sum -c ruqya-backup-<UTC>.tar.gpg.sha256          # must print: OK
    gpg --decrypt ruqya-backup-<UTC>.tar.gpg | tar -xf - -C <private folder>

or both at once: `scripts/restore.sh decrypt ruqya-backup-<UTC>.tar.gpg`. On Windows use Gpg4win and
`certutil -hashfile <file> SHA256`. The unpacked files contain patients' data and password hashes: keep them
private and delete them when done.

## Restore
Always into a **new, empty** project, never over the live one (`scripts/restore.sh` refuses both). Needs
`psql` 17 (`postgresql-client-17` from apt.postgresql.org).

- Test copy on your own computer (Docker): `scripts/restore.sh local <unpacked folder>`
- New supabase.com project, or self-hosted docker-compose (github.com/supabase/supabase/tree/master/docker):
  `scripts/restore.sh target <unpacked folder> "postgresql://...session pooler URI of the new project..."`

The script restores roles, schema, privileges and data in one transaction (all or nothing), then compares counts,
hashes and structure with the backup, and prints the remaining manual steps (sign-up settings, pointing the app at
the new project with `tools/configure.py`, see `.env.example`). Without the script, the same by hand:

    psql "$NEW_DB_URL" --single-transaction -v ON_ERROR_STOP=1 \
      --file roles.sql --file schema.sql --file post-schema.sql \
      --command 'SET session_replication_role = replica' --file data.sql
