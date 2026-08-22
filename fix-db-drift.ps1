<#
  Architect Hub -- fixes migration drift.
  The migration "20260822120000_..." got recorded as applied using an
  earlier version of its own SQL file (my mistake, across patches 2 and 3).
  This applies the two statements that were silently skipped, directly.
  Safe to run more than once (IF NOT EXISTS guards).
#>

$ErrorActionPreference = "Stop"
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)

$sql = @'
ALTER TYPE "Role" ADD VALUE IF NOT EXISTS 'SENIOR_ARCHITECT';
'@
[System.IO.File]::WriteAllText("$PWD\_fix1.sql", $sql, $utf8NoBom)

$sql2 = @'
ALTER TABLE "FirmSettings" ADD COLUMN IF NOT EXISTS "requireMfa" BOOLEAN NOT NULL DEFAULT false;
'@
[System.IO.File]::WriteAllText("$PWD\_fix2.sql", $sql2, $utf8NoBom)

Write-Host "Applying missing enum value..." -ForegroundColor Cyan
npx prisma db execute --file _fix1.sql --schema prisma/schema.prisma

Write-Host "Applying missing column..." -ForegroundColor Cyan
npx prisma db execute --file _fix2.sql --schema prisma/schema.prisma

Remove-Item _fix1.sql, _fix2.sql -ErrorAction SilentlyContinue

Write-Host ""
Write-Host "Done. Restart your dev server (Ctrl+C then npm run dev) to clear the stale Turbopack error state." -ForegroundColor Green
