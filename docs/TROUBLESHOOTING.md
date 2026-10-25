# Troubleshooting

| Symptom | Likely cause | Fix |
| --- | --- | --- |
| `Cannot reach the server` | Apache or MySQL is stopped | Run `scripts/start-xampp.ps1`; verify ports 80 and 3306 are listening. |
| `404 Not Found` under `/relieftrack-api/` | API files are missing from the Apache document root | Copy `php-api/index.php`, `php-api/.htaccess`, and `php-api/README.txt` to `C:/xampp/htdocs/relieftrack-api/`. |
| Browser CORS error | Origin does not match the allowlist or Apache overrides are disabled | Use localhost or 127.0.0.1 on port 5173; verify `mod_headers`, `mod_setenvif`, `mod_rewrite`, and `AllowOverride All`. Test OPTIONS preflight. |
| API returns SQL errors after deployment | Existing DB schema is behind the router | Run `scripts/migrate.ps1`; do not import the destructive fresh-install schema over existing data. |
| Staff login returns invalid credentials | Legacy plaintext password was not migrated or wrong account | The router hashes legacy accounts on startup. Retry the documented dev account only on a development DB. Check DB connectivity without printing password values. |
| Staff POST returns 403 | Missing/stale CSRF token or PHP session cookie | Refresh/re-authenticate so the app rehydrates its PHP session and token; allow cookies and the `X-CSRF-Token` preflight header. |
| OTP request returns 503 | PHP mail transport is unavailable | Configure mail delivery in the PHP environment. `RELIEF_ALLOW_DEBUG_CODES=1` is for non-production only. |
| Donation lookup shows no match | Reference typo or email mismatch | Use the returned `RT-######` reference; donation history requires the exact donor email. |
| Local demo says data was not saved | Browser localStorage is blocked or full | Enable site storage or clear space. API mode stores persistent data in MySQL instead. |
| Maps are blank | Network blocked OpenStreetMap tiles or missing coordinates | Allow tile requests and add latitude/longitude to locations. |

## Safe operational checks

```powershell
curl.exe -i http://localhost/relieftrack-api/locations.php
curl.exe -i -X OPTIONS -H "Origin: http://localhost:5173" -H "Access-Control-Request-Method: POST" -H "Access-Control-Request-Headers: content-type,x-csrf-token" http://localhost/relieftrack-api/donations.php
npm.cmd run lint
npm.cmd test
npm.cmd run build
```

Never print or commit `.env` contents, database passwords, SMTP credentials, password hashes, OTPs, or donor PII in bug reports.
