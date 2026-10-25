param(
    [string]$ApiBase = 'http://localhost/relieftrack-api',
    [string]$MysqlPath = 'C:\xampp\mysql\bin\mysql.exe',
    [string]$Database = $(if ($env:RELIEF_DB_NAME) { $env:RELIEF_DB_NAME } else { 'relieftrack' }),
    [string]$User = $(if ($env:RELIEF_DB_USER) { $env:RELIEF_DB_USER } else { 'root' }),
    [string]$StaffEmail = 'admin@relieftrack.com',
    [string]$StaffPassword = 'admin123',
    [switch]$KeepTestDonation
)

$ErrorActionPreference = 'Stop'
$ApiBase = $ApiBase.TrimEnd('/')
$testEmail = "relieftrack-smoke-$([guid]::NewGuid().ToString('N'))@example.invalid"
$donationId = $null

try {
    foreach ($endpoint in @('locations.php', 'operations.php')) {
        $response = Invoke-RestMethod -Uri "$ApiBase/$endpoint"
        if (-not $response.success) { throw "$endpoint returned success=false" }
        Write-Output "$endpoint success=true"
    }

    # Staff endpoints require a PHP session, so sign in before reading them.
    $session = New-Object Microsoft.PowerShell.Commands.WebRequestSession
    $login = Invoke-RestMethod -Uri "$ApiBase/admin_login.php" -Method Post -ContentType 'application/json' `
        -Body (@{ email = $StaffEmail; password = $StaffPassword } | ConvertTo-Json) -WebSession $session
    if (-not $login.success -or -not $login.data.admin.csrfToken) { throw 'admin_login.php did not return a staff session.' }
    Write-Output "admin_login.php success=true role=$($login.data.admin.role)"

    foreach ($endpoint in @('donations.php', 'dashboard.php')) {
        $response = Invoke-RestMethod -Uri "$ApiBase/$endpoint" -WebSession $session
        if (-not $response.success) { throw "$endpoint returned success=false" }
        Write-Output "$endpoint success=true"
    }

    $locations = (Invoke-RestMethod -Uri "$ApiBase/locations.php").data
    $operations = (Invoke-RestMethod -Uri "$ApiBase/operations.php").data
    $location = $locations | Where-Object { $_.kind -in @('donation_center', 'warehouse') } | Select-Object -First 1
    $operation = $operations | Select-Object -First 1
    if (-not $location -or -not $operation) { throw 'No operation or donation center is available for the smoke test.' }

    $payload = @{
        donorName = 'ReliefTrack API Smoke Test'
        donorEmail = $testEmail
        donorPhone = ''
        donationType = 'goods'
        amount = 0
        operationId = $operation.id
        preferredLocationId = $location.id
        donorPreference = 'Automated API smoke test'
        items = @(@{ name = 'ReliefTrack API Smoke Item'; category = 'Smoke Test'; quantity = 1; unit = 'item' })
    } | ConvertTo-Json -Depth 5

    $created = Invoke-RestMethod -Uri "$ApiBase/donation_create.php" -Method Post -ContentType 'application/json' -Body $payload
    if (-not $created.success -or -not $created.data.reference) { throw 'donation_create.php did not return a donation reference.' }
    $reference = $created.data.reference
    if ($reference -notmatch '^RT-(\d{6})$') { throw "Unexpected donation reference format: $reference" }
    $donationId = [int]$Matches[1]
    Write-Output "donation_create.php success=true reference=$reference"

    $tracked = Invoke-RestMethod -Uri "$ApiBase/donation_track.php?reference=$reference"
    if (-not $tracked.success -or $tracked.data.reference -ne $reference) { throw 'Donation tracking did not return the created donation.' }
    Write-Output "donation_track.php success=true reference=$reference"

    if (-not (Test-Path $MysqlPath)) { throw "MySQL client not found: $MysqlPath" }
    $verifySql = "SELECT CONCAT((SELECT COUNT(*) FROM donations WHERE donation_id=$donationId AND donor_email='$testEmail'), ':', (SELECT COUNT(*) FROM donation_items WHERE donation_id=$donationId), ':', (SELECT COUNT(*) FROM donation_updates WHERE donation_id=$donationId));"
    $mysqlArgs = @("--user=$User", "--database=$Database", '--batch', '--skip-column-names', "--execute=$verifySql")
    if ($env:RELIEF_DB_PASSWORD) { $env:MYSQL_PWD = $env:RELIEF_DB_PASSWORD }
    $counts = & $MysqlPath @mysqlArgs
    if ($LASTEXITCODE -ne 0) { throw "MySQL verification failed with exit code $LASTEXITCODE." }
    if ($counts.Trim() -ne '1:1:1') { throw "Expected one donation, item, and update row; database returned $counts." }
    Write-Output 'MySQL transaction rows verified: donation=1 item=1 update=1'
} finally {
    if ($donationId -and -not $KeepTestDonation -and (Test-Path $MysqlPath)) {
        $cleanupSql = "DELETE FROM donations WHERE donation_id=$donationId AND donor_email='$testEmail' AND donor_name='ReliefTrack API Smoke Test';"
        $cleanupArgs = @("--user=$User", "--database=$Database", '--batch', '--skip-column-names', "--execute=$cleanupSql")
        & $MysqlPath @cleanupArgs | Out-Null
        if ($LASTEXITCODE -eq 0) { Write-Output 'Smoke-test donation removed.' }
    }
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}
