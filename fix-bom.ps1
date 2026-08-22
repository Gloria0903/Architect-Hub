<#
  Architect Hub -- BOM fix for apply-patch-1.ps1
  Windows PowerShell's -Encoding UTF8 writes a UTF-8 BOM, which breaks
  Prisma's schema parser ("This line is invalid... does not start with
  any known Prisma schema keyword" on line 1). This rewrites the same
  files without a BOM. Run from the repo root, same folder as before.
#>

$ErrorActionPreference = "Stop"

$files = @(
  "prisma/schema.prisma",
  "src/lib/file-picker-guard.ts",
  "src/components/documents/document-uploader.tsx",
  "src/store/app-store.tsx",
  "prisma/migrations/20260822120000_prod_readiness_settings_and_daily_log_docs/migration.sql",
  "src/app/api/settings/firm/route.ts",
  "src/components/settings/firm-settings-card.tsx",
  "src/app/api/settings/notifications/route.ts",
  "src/app/api/health/route.ts",
  "src/app/api/documents/route.ts",
  "src/app/api/logs/route.ts",
  "src/app/daily-logs/new/page.tsx",
  "src/app/daily-logs/page.tsx",
  "src/app/settings/page.tsx",
  "src/app/api/auth/mfa/confirm/route.ts"
)

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

Write-Host "Stripping BOM from patched files..." -ForegroundColor Cyan

foreach ($f in $files) {
  if (Test-Path $f) {
    $text = Get-Content -Path $f -Raw
    $fullPath = (Resolve-Path $f).Path
    [System.IO.File]::WriteAllText($fullPath, $text, $utf8NoBom)
    Write-Host "  fixed: $f"
  } else {
    Write-Host "  MISSING (skipped): $f" -ForegroundColor Yellow
  }
}

Write-Host ""
Write-Host "Done. Now run:" -ForegroundColor Green
Write-Host "  npx prisma generate"
Write-Host "  npx prisma migrate deploy"
Write-Host "  npm run build"
