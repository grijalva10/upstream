# Start Upstream development environment
# Usage: .\scripts\dev.ps1

Write-Host "Checking Supabase status..." -ForegroundColor Cyan

# Check if Supabase is running (suppress stderr noise)
$null = npx supabase status 2>&1
if ($LASTEXITCODE -ne 0) {
    Write-Host "Starting Supabase..." -ForegroundColor Yellow
    npx supabase start
    if ($LASTEXITCODE -ne 0) {
        Write-Host "Failed to start Supabase" -ForegroundColor Red
        exit 1
    }
    Write-Host "Supabase started!" -ForegroundColor Green
} else {
    Write-Host "Supabase already running" -ForegroundColor Green
}

Write-Host ""
Write-Host "Starting worker in background..." -ForegroundColor Cyan

# Start worker in a new terminal window
$workerPath = Join-Path $PSScriptRoot "..\apps\worker"
Start-Process powershell -ArgumentList "-NoExit", "-Command", "Set-Location '$workerPath'; Write-Host 'Starting pg-boss worker...' -ForegroundColor Green; npm run dev"

Write-Host "Worker started in new terminal" -ForegroundColor Green
Write-Host ""
Write-Host "Starting web app..." -ForegroundColor Cyan
Write-Host "Open http://localhost:3000" -ForegroundColor Yellow
Write-Host ""

Set-Location apps/web
npm run dev
