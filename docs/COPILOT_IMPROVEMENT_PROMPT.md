# GitHub Copilot improvement prompt — ReliefTrack

Paste this prompt into GitHub Copilot Agent Mode (or an issue that Copilot can
act on). Every claim below was verified against the running stack on
2026-10-20; the "Verified state" section is the ground truth, so re-verify
before changing anything.

---

## 1. Context

ReliefTrack is a disaster-response coordination system for Caloocan, Metro
Manila.

| Layer | Path | Notes |
| --- | --- | --- |
| Frontend | `src/` | React 18 + Vite 5 + TypeScript 5 + Tailwind 3 |
| Typed service layer | `src/services/reliefService.ts` | `API_ENDPOINTS` registry is the single source of endpoint names |
| Transport | `src/services/http.ts` | picks the backend, unwraps `{success,data,message}`, attaches `X-CSRF-Token` |
| Local mock API | `src/services/localApi.ts` | `localStorage` backend that must mirror the PHP contract |
| PHP API | `php-api/index.php` | single-file PDO router, 744 lines, 24 endpoints |
| Apache rules | `php-api/.htaccess` | rewrite to the router + credentialed CORS allowlist |
| Fresh-install schema | `src/database/schema.sql` | **destructive** — drops and recreates tables |
| Live migrations | `scripts/migrate.sql` + `scripts/migrate.ps1` | idempotent, safe to re-run |
| Verification | `scripts/verify-api.ps1` | smoke test incl. MySQL row assertions |
| Contract docs | `src/database/API_CONTRACT.md`, `docs/DATA_MODEL.md`, `docs/TROUBLESHOOTING.md` | |
| Tests | `src/services/__tests__/` | `contract.test.ts`, `drift.test.ts`, `apiTestHarness.ts` |

Backend selection is driven by the project-root `.env`:

```env
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api
```

`VITE_DATA_MODE=local` selects `localApi.ts`; `api` selects the PHP API.
`VITE_API_BASE_URL=/api` is a **relative** path served by the Vite dev proxy
(`vite.config.ts` → `http://127.0.0.1:8080`), so the browser never needs CORS
in dev. The relative URL is why the Node test harness needs absolute fallbacks.

---

## 2. Verified state (do not regress)

- Apache serves `http://localhost/relieftrack-api`; the API is deployed to
  `C:\xampp\htdocs\relieftrack-api\` (`index.php`, `.htaccess`, `README.txt`).
- `scripts/dev.mjs` starts Vite on `5173` and `php -S 127.0.0.1:8080` with
  `php-api/index.php` as the router.
- MariaDB on `3306`, database `relieftrack`, user `root`, empty password.
- `php-api/index.php` runs runtime schema migration on every request, so the
  live database converges without a manual migration step.
- Staff read endpoints are session-gated by `requireStaff()`:
  `dashboard.php`, `alerts.php`, `activity_log.php`, `inventory.php`,
  `volunteers.php`, `donations.php`. The React staff console
  (`Topbar`, `Dashboard`, `PanelPage`) is the only caller and signs in first,
  so this gating is correct — keep it.
- Staff login calls `session_regenerate_id(true)`, so the server sends **two**
  `PHPSESSID` cookies. Clients must keep the last value for a duplicated
  cookie name; `apiTestHarness.ts` already does this.
- `scripts/verify-api.ps1` passes: `donation_create.php` → `donation_track.php`
  → MySQL row assertions (`donation=1 item=1 update=1`).
- `npm.cmd test` passes: 4 tests, and the drift report shows **MATCH** for all
  12 compared endpoints (6 public, 6 staff).
- `npx tsc --noEmit` is clean. `npm.cmd run lint` reports 0 errors and 7
  warnings (the documented baseline). `npm.cmd run build` succeeds with a
  chunk-size warning.

Demo credentials (development only): `admin@relieftrack.com` / `admin123`;
volunteer `john@example.com` / code `123456`.

---

## 3. Work items

### 3.1 Deployment (make the deploy repeatable and self-verifying)

**Problem.** `php-api/index.php` and `php-api/.htaccess` must be copied into
`C:\xampp\htdocs\relieftrack-api\` by hand. The project copy and the deployed
copy already drifted once: the deployed file was missing 6 `requireStaff()`
calls, so the live API served staff data to unauthenticated callers while the
project behaved correctly. Nothing detected the drift.

**Do this.**

1. Add `scripts/deploy-api.ps1` that:
   - copies `php-api/index.php`, `php-api/.htaccess`, and `php-api/README.txt`
     into the target `htdocs` directory (make the target a parameter);
   - compares SHA-256 hashes of source and destination after copying and fails
     on mismatch;
   - refuses to run if the target directory does not exist, rather than
     creating a stray folder;
   - prints the resolved `VITE_API_BASE_URL` and whether Apache is listening.
2. Add a drift check to `scripts/verify-api.ps1`: compare the deployed
   `index.php` hash against the project `php-api/index.php` and fail loudly
   when they differ, naming the stale side.
3. Update `php-api/README.txt` to document the staff login flow
   (`admin_login.php` → session cookie → `X-CSRF-Token` on staff POSTs), since
   the current text only shows `locations.php` and gives no way to reach the
   staff endpoints.
4. Update the project `README.md` deployment steps to call
   `scripts/deploy-api.ps1` instead of "copy the files".

### 3.2 Schema and migrations

**Problem.** `schema.sql` and `migrate.sql` have drifted from each other and
from the live database, and nothing records which migrations have run. The
`locations` table gained `contact_phone`, `operated_by`, `photo_url`,
`feedback_rating`, `feedback_count`, and `detail` across several separate
`ALTER TABLE` statements, each of which had to be hand-written twice (once in
the PHP runtime migration, once in `migrate.sql`).

**Do this.**

1. Introduce a migration ledger: a `schema_migrations` table with
   `(id VARCHAR(64) PRIMARY KEY, applied_at TIMESTAMP)`. Record an id in the
   same transaction as each migration's DML.
2. Restructure `scripts/migrate.sql` so each migration is a named, ordered
   step, and the script skips steps already recorded in the ledger. Keep the
   script safe to re-run.
3. Replace the PHP runtime migration block in `php-api/index.php` with a
   single call into a shared, ordered list of migrations so the two paths
   cannot drift again. The runtime path must stay tolerant: wrap each step so
   one failure does not take the whole API down.
4. Add `scripts/verify-schema.ps1` that compares the live database against the
   expectations encoded in `schema.sql` (tables, columns, types, nullability,
   indexes, foreign keys) and prints a readable table of differences. It must
   be read-only.
5. Add the missing indexes that the query patterns in `php-api/index.php`
   need — at minimum `donations(preferred_location_id)`, `shifts(location_id)`,
   `donations(status)`, and `alerts(priority, created_at)`. Use
   `information_schema` guards so the script stays idempotent.
6. Seed the nullable volunteer credential columns
   (`driving_license_number`, `driving_license_type`, `first_aid_qualification`)
   with realistic demo values instead of leaving them `NULL`, so the roster
   screen is not empty in a fresh install. Keep them `NULL`-safe in the API
   (`?? ''`).
7. Document in `docs/DATA_MODEL.md` which columns are authoritative for
   `locations` and how `operation_locations` relates to the legacy
   `locations.operation_id` column.

### 3.3 API correctness

**Problem.** `php-api/index.php` is a single 744-line file with 24 `case`
branches. A read endpoint writes to the database. Error handling turns every
PHP notice into a fatal exception.

**Do this.**

1. Split the router into a thin `php-api/index.php` that resolves the
   endpoint and dispatches, plus `php-api/endpoints/<name>.php` files that
   each export a handler. Keep the single `PDO` connection and the shared
   `ok()` / `fail()` / `requireStaff()` helpers in a shared
   `php-api/bootstrap.php`. Do not change the response envelope, endpoint
   names, or field names — `src/database/API_CONTRACT.md` and the drift test
   are the contract.
2. Fix the side effect in a GET. `dashboard.php` calls
   `generateOperationalAlerts($pdo)`, which inserts into `alerts`. A GET must
   not mutate state. Move alert generation into the write paths that create
   the underlying condition (inventory below threshold, donation stage
   changes), and have `dashboard.php` read alerts only. If a periodic sweep
   is required, expose it as an explicit staff-authenticated endpoint instead
   of a hidden side effect.
3. Make error handling production-safe. The global
   `set_error_handler` converts every diagnostic — including `E_NOTICE` and
   `E_DEPRECATED` — into a thrown `ErrorException`, so a harmless notice
   fails the whole request. Only convert `E_ERROR`, `E_CORE_ERROR`,
   `E_COMPILE_ERROR`, and `E_USER_ERROR` into exceptions; log the rest. When
   a `RELIEF_ENV=production` flag is set, never return internal messages or
   stack traces to the client — return a generic message plus a correlation
   id, and log the detail server-side.
4. Add a request correlation id to every response (a header such as
   `X-Request-Id`) and include it in error payloads and server logs, so a
   failed browser request can be traced to a log line.
5. Add a structured error log written to `php-api/storage/error.log` (create
   the directory, and make sure `.htaccess` denies direct access to it).
6. Replace the remaining raw `PDOException` messages in `fail(...)` calls with
   user-safe text; the current
   `fail('Could not create operation: ' . $e->getMessage(), 500)` leaks SQL
   detail to the browser.
7. Purge stale rows from `api_rate_limits` at API startup rather than only
   inside `enforceRateLimit()`, which is currently called for exactly one
   endpoint. Otherwise the table grows without bound whenever that endpoint is
   idle.
8. Validate `donation_create.php` input more strictly: reject a negative
   amount, a non-positive quantity on any item, an unknown `operationId` or
   `preferredLocationId`, and an items array that is empty for a `goods` or
   `mixed` donation. Return 422 with a specific message for each case.

### 3.4 TypeScript and local-mock parity

**Problem.** `src/services/localApi.ts` is a 30 KB file holding the seed
fixtures and every endpoint handler inline. Drift between the mock and the
PHP contract is detected only by a test that silently skips when the API is
unreachable. The drift test compares *shape*, so a field that is always `null`
in the live data and always `''` in the mock passes while the UI still
renders differently in the two modes.

**Do this.**

1. Split `src/services/localApi.ts` into:
   - `src/services/local/fixtures.ts` — the seeded operations, locations,
     shifts, skills, inventory, needed items, shipments, volunteers, and
     donations;
   - `src/services/local/handlers.ts` — one function per endpoint;
   - `src/services/local/store.ts` — the localStorage read/write/seed/migrate
     layer.
   Keep the public `localRequest(path, init)` export and its behaviour
   identical; `src/services/http.ts` and the tests depend on it.
2. Make the drift test fail loudly instead of skipping. Today
   `contract.test.ts` calls `skip()` when no API is reachable, so a broken
   deployment looks like a passing suite. Change it to:
   - fail with a clear message when `VITE_DATA_MODE=api` is configured but no
     API is reachable;
   - skip only when the environment explicitly opts out, e.g.
     `RELIEF_SKIP_LIVE_API=1`.
3. Strengthen the comparison from *shape* to *field-level semantics*. Add a
   table of per-endpoint rules that the mock and the live API must both
   satisfy — for example, "every `ReliefLocation.operatedBy` is a non-empty
   string or `null`, never `undefined`", "every `VolunteerRosterEntry` string
   field is `''` rather than `undefined`", "every `Shift.requiredSkills` is an
   array of non-empty strings". Assert the rules against both sides.
4. Align the shared type definitions in `src/types/domain.ts` with the real
   data. `ReliefLocation.kind` includes `'vehicle'`, which is not a value the
   `locations.location_type` ENUM can hold — remove it or add the ENUM value.
   `DonorEntry.amount` is a `string` in the contract but the live API formats
   it as `'₱1,234'` while the mock emits a bare numeric string; make both
   sides use the same formatter and document it.
5. Add runtime validation of API responses at the transport boundary in
   `src/services/http.ts` so a malformed payload fails with a clear error
   instead of surfacing as `undefined` deep inside a component. Keep it
   dependency-free or add a small validator — do not pull in a large schema
   library for this.
6. Improve `src/hooks/useResource.ts`: surface a distinct "unauthorised"
   state so the staff console can route to the login screen instead of
   showing a generic error, and refetch when the window regains focus so the
   dashboard reflects changes made by another staff member.
7. Give `src/services/http.ts` a bounded retry with backoff for transient
   network errors on GET only, and never retry a mutation. Respect the
   caller's `AbortSignal`.
8. Map PHP error messages onto the existing `ApiError` type with a stable
   `code` field, so the UI can distinguish "not authorised" from "server
   error" without string matching on the message.

### 3.5 Authentication and sessions

**Problem.** `admin_login.php` is not rate limited, so staff passwords can be
brute forced. Volunteer mutations rely on `SameSite=Lax` alone instead of a
CSRF token. Sessions never expire.

**Do this.**

1. Add rate limiting to `admin_login.php` using the existing
   `enforceRateLimit()` helper: cap failures per email **and** per IP (for
   example 10 attempts per 15 minutes), and apply a short lockout after
   repeated failures. Return a generic `Invalid email or password.` for
   unknown users and wrong passwords alike so the response does not reveal
   which accounts exist. Record the attempt in `activity_log`.
2. Require a CSRF token for the volunteer mutations `shift_join.php` and
   `shift_cancel.php`, matching the staff mutation pattern. The volunteer
   session must expose a token (issue it when the session is established in
   `auth_verify_code.php` and return it from `volunteer_session.php`).
3. Add an idle timeout and an absolute lifetime to both session types. Set
   `session.gc_maxlifetime` and check the last-activity timestamp in
   `requireStaff()` and `requireVolunteer()`, ending an expired session with
   a clear `401`.
4. Make `volunteer_logout.php` require a CSRF token like the other
   mutations, for consistency.
5. Verify the authorisation checks in `volunteer_shifts.php`, `shift_join.php`,
   and `shift_cancel.php` cannot be used to read or mutate another volunteer's
   shifts by changing the `volunteer_id` query parameter. Add a regression
   test for each.
6. Never log a password, OTP, CSRF token, or session id. Add a redaction
   helper and route every log line through it.
7. Confirm that `password_hash()` uses `PASSWORD_DEFAULT` and that the
   automatic re-hash of legacy plaintext seeds in `php-api/index.php` only runs
   when `password_get_info()['algo']` is `null`. Add a unit test that a
   pre-hashed password is not double-hashed.

### 3.6 CORS

**Problem.** `php-api/.htaccess` allows any `localhost`/`127.0.0.1` origin on
**any** port, which is fine for development but too broad for a deployment
that shares a host. There is no preflight cache, and the allowlist cannot be
configured per environment.

**Do this.**

1. Drive the allowlist from the server environment. Read an
   `RELIEF_ALLOWED_ORIGINS` environment variable (comma-separated) and fall
   back to the current development allowlist only when the variable is unset
   **and** the host is localhost. In production, an unset variable must mean
   "no cross-origin access", not "allow everything local".
2. Validate each origin against the allowlist with an exact string match on
   scheme, host, and port. Never use a prefix or wildcard match, and never
   emit `Access-Control-Allow-Origin: *` alongside
   `Access-Control-Allow-Credentials: true`.
3. Add `Access-Control-Max-Age` so browsers cache the preflight response.
4. Keep `Vary: Origin` on every response that varies by origin, including
   error responses and the preflight response.
5. Add an `OPTIONS` test that asserts the allowlist is enforced: a request
   from a disallowed origin must not receive
   `Access-Control-Allow-Credentials`, and a request from an allowed origin
   must receive the exact origin string it sent — never a reflected
   unvalidated value.
6. Document the difference between the Vite dev proxy (same-origin, no CORS
   involved) and a production deployment that serves the built assets from
   Apache and therefore does need CORS.

### 3.7 Persistence

**Problem.** The local demo backend is `localStorage` while the real backend is
MySQL, so persistence semantics differ between the two modes that the app
supports. There is no backup guidance, donations are hard-deleted, and there
is no record of who performed a destructive action beyond a single
`activity_log` row.

**Do this.**

1. Document the persistence model in `docs/DATA_MODEL.md`: what lives in
   `localStorage`, what lives in MySQL, and which writes are lost when the
   browser storage is cleared. State plainly that the local mode is a demo and
   is not a substitute for the API mode.
2. Add a soft-delete to donations: a `deleted_at` column, filter it out of
   every read, and keep the row for audit. The existing hard delete in
   `admin_donations_delete.php` should still refuse to delete a donation that
   a shipment references, and it should now mark the row instead of removing
   it.
3. Record every destructive staff action in `activity_log` with the staff id,
   the entity, and a human-readable summary — including the donation stage
   changes and the operation creation that already log, plus the deletions.
4. Add `scripts/backup-db.ps1` that runs `mysqldump` against the configured
   database into a timestamped file under a `backups/` directory, and add the
   restore command to `docs/TROUBLESHOOTING.md`. Exclude `backups/` from any
   web-served directory.
5. Add a startup integrity check that verifies the database is reachable and
   that the expected tables exist, and return a clear `503` with a diagnostic
   message when it is not, rather than a generic `500`.
6. Make the donation reference sequence gap-free. `donation_create.php`
   derives the next reference from the highest existing id plus one, so a
   deleted donation leaves a gap in the `RT-######` sequence. Use a
   transactionally reserved sequence (for example a dedicated
   `donation_reference_seq` table with an atomic increment) so references stay
   contiguous.
7. Add a `donation_list.php` index on the exact lookup column and verify the
   rate-limit identity is not trivially bypassable by changing the email
   casing or adding whitespace.

---

## 4. Constraints and guardrails

- Do not change the response envelope, endpoint names, or response field
  names. `src/database/API_CONTRACT.md` and
  `src/services/__tests__/contract.test.ts` are the contract, and the drift
  test must keep reporting **MATCH** for all 12 endpoints.
- Do not remove the `requireStaff()` gating from the six staff read
  endpoints.
- Do not weaken the CORS allowlist to `*`, and do not add
  `Access-Control-Allow-Origin` reflection without an exact allowlist check.
- Do not introduce a new runtime dependency without saying so explicitly and
  updating `package.json` and the lockfile.
- Keep `src/services/http.ts` as the only place that talks to the network, and
  `src/services/localApi.ts` as the only local mock entry point, so the
  backend swap stays a one-line change.
- Never put database credentials, SMTP secrets, or the PHP session
  configuration in the frontend `.env` file. Database and mail configuration
  belong to the PHP server environment.
- Do not weaken the rate limit on `donation_list.php` or the OTP lockout.
- Keep the demo credentials development-only and add a visible warning in the
  login screen when the API reports a development build.

---

## 5. Acceptance criteria

Run and paste the output of all of the following. Each must pass.

```powershell
npm.cmd install
npx tsc --noEmit                 # 0 errors
npm.cmd run lint                 # 0 errors, warnings <= the 7-warning baseline
npm.cmd test                     # 4+ tests, drift report: MATCH for all 12 endpoints
npm.cmd run build                # builds; no new errors
scripts\migrate.ps1              # idempotent; re-running succeeds
scripts\verify-api.ps1           # every endpoint success=true; MySQL rows verified
scripts\verify-schema.ps1        # reports no unexpected schema differences
scripts\deploy-api.ps1           # copies, verifies hashes, reports no drift
```

Manual acceptance:

1. Sign in at the staff login with `admin@relieftrack.com` / `admin123`.
   The dashboard, alerts, activity feed, inventory, roster, and donation ledger
   all load with data.
2. Open the relief map. Every checkpoint popup shows **Operated by** and a
   checkpoint description, and the operation link lines connect the
   checkpoints that belong to the same operation.
3. Submit a donation from the public site. Reload the page and restart the
   dev server — the donation is still tracked by its reference.
4. Sign out. The staff endpoints now return `401 Staff authentication required.`
5. From an origin that is not in the CORS allowlist, confirm the browser
   blocks the request and the response carries no
   `Access-Control-Allow-Credentials` header.
6. With `VITE_DATA_MODE=local`, confirm the app still runs end to end and the
   drift report still reports **MATCH** for all 12 endpoints.
