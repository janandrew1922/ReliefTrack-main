ReliefTrack PHP API
===================

Deployment
----------
1. Import src/database/schema.sql into MariaDB/MySQL. The schema creates the
   relieftrack database and its tables.
2. Copy php-api/index.php and php-api/.htaccess into:
   C:\xampp\htdocs\relieftrack-api\
3. Start Apache and MySQL in XAMPP, then test:
   http://localhost/relieftrack-api/locations.php
4. The API uses RELIEF_DB_HOST, RELIEF_DB_NAME, RELIEF_DB_USER, and
   RELIEF_DB_PASSWORD from the PHP process environment. Defaults are
   127.0.0.1, relieftrack, root, and an empty password.
5. Set VITE_DATA_MODE=api and VITE_API_BASE_URL=http://localhost/relieftrack-api
   in the React project's root .env file, then restart Vite.

The Apache rules allow credentialed requests from localhost and 127.0.0.1
development origins. Do not replace this allowlist with Access-Control-Allow-Origin: *.
The API uses a PHP session cookie for staff authentication.

Start XAMPP after reboot
-----------------------
From the project root, run scripts\start-xampp.ps1. It starts Apache/MySQL only
when their ports are not already listening and waits for both ports to respond.

Optional permanent Windows services (run manually in an elevated PowerShell):
  C:\xampp\apache\bin\httpd.exe -k install -n "Apache2.4"
  C:\xampp\mysql\bin\mysqld.exe -i install --defaults-file=C:\xampp\mysql\bin\my.ini
  sc.exe config Apache2.4 start= auto
  sc.exe config MySQL start= auto

The application .env belongs in the React project root. PHP does not read a
Vite .env file. Configure production SMTP and database variables in the server
environment; never put those secrets in the frontend .env file.