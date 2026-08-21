param(
    [Parameter(Mandatory = $true, Position = 0)]
    [string]$ServiceName
)

$ErrorActionPreference = "Stop"

if ($ServiceName -notmatch '^[a-z0-9-]+$') {
    throw "Service name must contain only lowercase letters, numbers, and hyphens."
}

$projectRoot = Split-Path -Parent $PSScriptRoot

Push-Location $projectRoot

try {
    $configPath = "apps/$ServiceName/prisma.config.ts"
    $schemaPath = "apps/$ServiceName/prisma/schema.prisma"

    if (-not (Test-Path $configPath)) {
        throw "Prisma configuration not found: $configPath"
    }

    if (-not (Test-Path $schemaPath)) {
        throw "Prisma schema not found: $schemaPath"
    }

    Write-Host ""
    Write-Host "Generating Prisma client for $ServiceName..." -ForegroundColor Cyan

    npx prisma generate --config $configPath

    if ($LASTEXITCODE -ne 0) {
        throw "Prisma client generation failed for $ServiceName."
    }

    Write-Host ""
    Write-Host "Prisma client generated successfully for $ServiceName." -ForegroundColor Green
}
finally {
    Pop-Location
}