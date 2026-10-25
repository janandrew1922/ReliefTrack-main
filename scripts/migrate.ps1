param(
    [string]$MysqlPath = 'C:\xampp\mysql\bin\mysql.exe',
    [string]$Database = $(if ($env:RELIEF_DB_NAME) { $env:RELIEF_DB_NAME } else { 'relieftrack' }),
    [string]$User = $(if ($env:RELIEF_DB_USER) { $env:RELIEF_DB_USER } else { 'root' }),
    [string]$HostName = $(if ($env:RELIEF_DB_HOST) { $env:RELIEF_DB_HOST } else { '127.0.0.1' })
)

$ErrorActionPreference = 'Stop'
$migrationFile = Join-Path $PSScriptRoot 'migrate.sql'
if (-not (Test-Path $MysqlPath)) { throw "MySQL client not found: $MysqlPath" }
if (-not (Test-Path $migrationFile)) { throw "Migration SQL not found: $migrationFile" }

$mysqlArgs = @("--host=$HostName", "--user=$User", '--database', $Database, '--batch', '--show-warnings')
if ($env:RELIEF_DB_PASSWORD) { $env:MYSQL_PWD = $env:RELIEF_DB_PASSWORD }
try {
    Get-Content -Raw $migrationFile | & $MysqlPath @mysqlArgs
    if ($LASTEXITCODE -ne 0) { throw "Migration failed with mysql exit code $LASTEXITCODE." }
    Write-Output "Migrations applied to database '$Database'. Re-running is safe."
} finally {
    Remove-Item Env:\MYSQL_PWD -ErrorAction SilentlyContinue
}