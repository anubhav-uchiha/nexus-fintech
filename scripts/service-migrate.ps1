param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ServiceName,

    [Parameter(Mandatory = $true, Position = 1)]
    [string]$MigrationName
)

$ErrorActionPreference = "Stop"

if ($ServiceName -notmatch '^[a-z0-9-]+$') {
    throw "Service name must contain only lowercase letters, numbers, and hyphens."
}

if ($MigrationName -notmatch '^[a-zA-Z0-9_]+$') {
    throw "Migration name must contain only letters, numbers, and underscores."
}

$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $projectRoot

try {
    $servicePath = "apps/$ServiceName"

    $configPath = "$servicePath/prisma.config.ts"

    $schemaPath = "$servicePath/prisma/schema.prisma"

    $migrationsRoot = "$servicePath/prisma/migrations"

    if (-not (Test-Path $servicePath)) {
        throw "Service directory not found: $servicePath"
    }

    if (-not (Test-Path $configPath)) {
        throw "Prisma configuration not found: $configPath"
    }

    if (-not (Test-Path $schemaPath)) {
        throw "Prisma schema not found: $schemaPath"
    }

    if (-not (Test-Path $migrationsRoot)) {
        throw "Migrations directory not found: $migrationsRoot"
    }

    Write-Host ""
    Write-Host "Service: $ServiceName" -ForegroundColor Cyan

    $existingMigrations = @(
    Get-ChildItem -Path $migrationsRoot -Directory
)

if ($existingMigrations.Count -eq 0) {
    Write-Host ""
    Write-Host "No existing migrations found. Checking that the database is empty..." -ForegroundColor Cyan

    npx prisma migrate diff `
        --config $configPath `
        --from-empty `
        --to-config-datasource `
        --exit-code

    if ($LASTEXITCODE -eq 2) {
        throw "The selected database already contains existing tables. Do not create the initial migration against another service's database."
    }

    if ($LASTEXITCODE -ne 0) {
        throw "Could not verify that the selected database is empty."
    }

    Write-Host ""
    Write-Host "Database is empty. Creating the initial migration." -ForegroundColor Green
}
else {
    Write-Host ""
    Write-Host "Checking the current database and migration status..." -ForegroundColor Cyan

    npx prisma migrate status --config $configPath

    if ($LASTEXITCODE -ne 0) {
        throw "Migration status check failed. Check the selected database and existing migrations."
    }
}

    $timestamp = Get-Date -Format "yyyyMMddHHmmss"

    $migrationFolder = "${timestamp}_${MigrationName}"

    $migrationPath = "$migrationsRoot/$migrationFolder"

    Write-Host ""
    Write-Host "Creating migration: $migrationFolder" -ForegroundColor Cyan

    New-Item -ItemType Directory -Path $migrationPath | Out-Null

    Write-Host ""
    Write-Host "Generating migration SQL..." -ForegroundColor Cyan

    npx prisma migrate diff `
        --config $configPath `
        --from-config-datasource `
        --to-schema $schemaPath `
        --script `
        --output "$migrationPath/migration.sql"

    if ($LASTEXITCODE -ne 0) {
        throw "Migration SQL generation failed."
    }

    Write-Host ""
    Write-Host "Generated SQL:" -ForegroundColor Yellow
    Write-Host ""

    Get-Content "$migrationPath/migration.sql"

    Write-Host ""

    $confirmation = Read-Host "Apply this migration to the database for $ServiceName? Type YES to continue"

    if ($confirmation -ne "YES") {
        Write-Host ""
        Write-Host "Migration was created but not applied." -ForegroundColor Yellow

        return
    }

    Write-Host ""
    Write-Host "Applying migration..." -ForegroundColor Cyan

    npx prisma migrate deploy --config $configPath

    if ($LASTEXITCODE -ne 0) {
        throw "Migration deployment failed."
    }

    Write-Host ""
    Write-Host "Generating Prisma client..." -ForegroundColor Cyan

    npx prisma generate --config $configPath

    if ($LASTEXITCODE -ne 0) {
        throw "Prisma client generation failed."
    }

    Write-Host ""
    Write-Host "Checking final migration status..." -ForegroundColor Cyan

    npx prisma migrate status --config $configPath

    if ($LASTEXITCODE -ne 0) {
        throw "Final migration status check failed."
    }

    Write-Host ""
    Write-Host "Migration completed successfully for $ServiceName." -ForegroundColor Green
}
finally {
    Pop-Location
}