param(
    [ValidateRange(1, 300)]
    [int]$TimeoutSeconds = 30
)

$ErrorActionPreference = 'Stop'
$xamppRoot = 'C:\xampp'
$apachePath = Join-Path $xamppRoot 'apache\bin\httpd.exe'
$mysqlPath = Join-Path $xamppRoot 'mysql\bin\mysqld.exe'
$mysqlIni = Join-Path $xamppRoot 'mysql\bin\my.ini'

# Optional permanent setup (run manually from an elevated PowerShell):
# C:\xampp\apache\bin\httpd.exe -k install -n "Apache2.4"
# C:\xampp\mysql\bin\mysqld.exe -i install --defaults-file=C:\xampp\mysql\bin\my.ini
# sc.exe config Apache2.4 start= auto
# sc.exe config MySQL start= auto

function Test-TcpPort([int]$Port) {
    $client = [System.Net.Sockets.TcpClient]::new()
    try {
        $result = $client.BeginConnect('127.0.0.1', $Port, $null, $null)
        if (-not $result.AsyncWaitHandle.WaitOne(500)) { return $false }
        $client.EndConnect($result)
        return $true
    } catch {
        return $false
    } finally {
        $client.Dispose()
    }
}

if (-not (Test-TcpPort 3306)) {
    if (-not (Test-Path $mysqlPath) -or -not (Test-Path $mysqlIni)) {
        throw "MySQL executable or configuration not found under $xamppRoot."
    }
    Start-Process -FilePath $mysqlPath -ArgumentList @("--defaults-file=$mysqlIni", '--standalone') -WorkingDirectory (Split-Path $mysqlPath) -WindowStyle Hidden
    Write-Output 'Started MySQL.'
} else {
    Write-Output 'MySQL is already listening on port 3306.'
}

if (-not (Test-TcpPort 80)) {
    if (-not (Test-Path $apachePath)) {
        throw "Apache executable not found under $xamppRoot."
    }
    Start-Process -FilePath $apachePath -WorkingDirectory (Split-Path $apachePath) -WindowStyle Hidden
    Write-Output 'Started Apache.'
} else {
    Write-Output 'Apache is already listening on port 80.'
}

$deadline = [DateTime]::UtcNow.AddSeconds($TimeoutSeconds)
do {
    $mysqlReady = Test-TcpPort 3306
    $apacheReady = Test-TcpPort 80
    if ($mysqlReady -and $apacheReady) {
        Write-Output 'ReliefTrack services are ready (Apache :80, MySQL :3306).'
        exit 0
    }
    Start-Sleep -Milliseconds 500
} while ([DateTime]::UtcNow -lt $deadline)

$missing = @()
if (-not $apacheReady) { $missing += 'Apache :80' }
if (-not $mysqlReady) { $missing += 'MySQL :3306' }
Write-Error "Timed out waiting for $($missing -join ' and '). Check C:\xampp\apache\logs and C:\xampp\mysql\data."
exit 1