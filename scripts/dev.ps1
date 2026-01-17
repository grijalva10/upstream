# Start Upstream development environment (single console)
# Usage: .\scripts\dev.ps1

Write-Host "================================" -ForegroundColor Cyan
Write-Host "  Upstream Dev Environment" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Kill any existing instances first
Write-Host "Cleaning up existing processes..." -ForegroundColor Yellow

# Stop CoStar service (port 8765)
$costarProc = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
if ($costarProc) {
    Stop-Process -Id $costarProc -Force -ErrorAction SilentlyContinue
    Write-Host "  Stopped existing CoStar service" -ForegroundColor Gray
}

# Stop worker
$nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "apps[/\\]worker"
}
if ($nodeProcs) {
    $nodeProcs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
    Write-Host "  Stopped existing Worker" -ForegroundColor Gray
}

# Stop web app (port 3000)
$webProc = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
if ($webProc) {
    Stop-Process -Id $webProc -Force -ErrorAction SilentlyContinue
    Write-Host "  Stopped existing Web app" -ForegroundColor Gray
}

Write-Host ""

# Check if Supabase is running
Write-Host "Checking Supabase status..." -ForegroundColor Cyan
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
Write-Host "Starting all services in parallel..." -ForegroundColor Cyan
Write-Host "  [web]    -> http://localhost:3000" -ForegroundColor White
Write-Host "  [worker] -> pg-boss background jobs" -ForegroundColor White
Write-Host "  [costar] -> http://localhost:8765" -ForegroundColor White
Write-Host ""
Write-Host "Press Ctrl+C to stop all services" -ForegroundColor Yellow
Write-Host ""

# Run all services with concurrently
npx concurrently `
    --names "web,worker,costar" `
    --prefix-colors "blue,green,yellow" `
    --prefix "[{name}]" `
    --kill-others-on-fail `
    --handle-input `
    "cd apps/web && npm run dev" `
    "cd apps/worker && npm run dev" `
    "python integrations/costar/service.py"
