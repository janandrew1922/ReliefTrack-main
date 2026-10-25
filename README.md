# ReliefTrack

ReliefTrack is a disaster-response coordination system for Caloocan, Metro Manila. It combines a React 18/Vite/TypeScript client with a PHP 8 JSON API and MySQL/MariaDB database.

## Architecture

- `src/pages` and `src/components`: public donor/volunteer pages and staff dashboard.
- `src/services/reliefService.ts`: typed API methods and the shared `API_ENDPOINTS` registry.
- `src/services/http.ts`: JSON envelope handling, API/local mode selection, credentials, and CSRF header.
- `src/services/localApi.ts`: localStorage-backed demo API.
- `php-api/index.php`: PDO router for the API endpoints.
- `src/database/schema.sql`: fresh-install schema and sample data.
- `scripts/migrate.sql` and `scripts/migrate.ps1`: idempotent live database migrations.

## Prerequisites

- Node.js 20 or newer and npm.
- For API mode: XAMPP with Apache, PHP 8 (PDO MySQL), and MySQL/MariaDB.
- Apache modules `mod_rewrite`, `mod_headers`, and `mod_setenvif`; `AllowOverride All` for the API directory.

## Local demo

```powershell
npm.cmd install
npm.cmd run dev
```

Open `http://127.0.0.1:5173`. The default mode uses seeded localStorage data. Demo staff credentials are `admin@relieftrack.com` / `admin123`; volunteer demo sign-in is `john@example.com` with code `123456`. These are development-only credentials.

Local changes persist in browser localStorage under `relieftrack.local-store`. If browser storage is blocked or full, the app warns that changes cannot persist and the mock API returns a save error.

## XAMPP API setup

1. Start Apache and MySQL in XAMPP. From the project root, run `scripts/start-xampp.ps1`; it starts services only when the ports are not already listening.
2. For a new database, import `src/database/schema.sql` using phpMyAdmin. **This schema drops and recreates tables. Do not import it over data you need to keep.**
3. For an existing database, run `scripts/migrate.ps1` instead. It is repeatable and does not drop tables.
4. Copy `php-api/index.php`, `php-api/.htaccess`, and `php-api/README.txt` to `C:/xampp/htdocs/relieftrack-api/`.
5. PHP defaults to host `127.0.0.1`, database `relieftrack`, user `root`, and an empty password. Set `RELIEF_DB_HOST`, `RELIEF_DB_NAME`, `RELIEF_DB_USER`, and `RELIEF_DB_PASSWORD` in the PHP server environment when needed. Never place database credentials or SMTP secrets in a Vite environment file.
6. Set the project-root `.env`:

```env
VITE_DATA_MODE=api
VITE_API_BASE_URL=http://localhost/relieftrack-api
```

7. Restart Vite after changing `.env`. CORS supports both `http://localhost:5173` and `http://127.0.0.1:5173` with credentialed sessions.

### Optional permanent Windows services

Run these commands manually from an elevated PowerShell only if you want Apache and MySQL to start at boot. Project scripts do not install services:

```powershell
C:/xampp/apache/bin/httpd.exe -k install -n "Apache2.4"
C:/xampp/mysql/bin/mysqld.exe -i install --defaults-file=C:/xampp/mysql/bin/my.ini
sc.exe config Apache2.4 start= auto
sc.exe config MySQL start= auto
```

## Commands

```powershell
npm.cmd run dev
npm.cmd run lint
npm.cmd test
npm.cmd run build
scripts/migrate.ps1
scripts/verify-api.ps1
```

TypeScript passes. ESLint currently reports zero errors and seven warnings. The production build succeeds with a bundle-size warning.

## Authentication and operational notes

- Staff mutations require a PHP session and CSRF token.
- Staff passwords and volunteer OTPs are stored as hashes. OTP requests are rate-limited and failed attempts lock the code. Debug codes are disabled by default; only set `RELIEF_ALLOW_DEBUG_CODES=1` on a non-production PHP server for testing.
- Production email delivery requires PHP mail transport configuration (`mail()`/SMTP). No SMS provider is bundled, so phone-number verification is not enabled.
- XAMPP is not automatically installed as Windows services. Use the launcher after reboot or configure the optional services manually.

## Troubleshooting

| Symptom | Likely cause | Check |
| --- | --- | --- |
| `Cannot reach the server` | Apache or MySQL is stopped | Run `scripts/start-xampp.ps1`; check ports 80 and 3306. |
| Browser CORS error | Origin is not allowed or Apache overrides are disabled | Use localhost/127.0.0.1 on port 5173; check `.htaccess` and `AllowOverride All`. |
| API returns SQL errors | Live schema is behind | Run `scripts/migrate.ps1`; do not re-import the destructive fresh-install schema. |
| Email code request returns 503 | PHP mail delivery is not configured | Configure the server mail transport; never expose debug codes in production. |

See `src/database/API_CONTRACT.md` for routes and response shapes, and `docs/DATA_MODEL.md` for the relational model.
