# Stop Upstream development environment
# Usage: .\scripts\stop.ps1

Write-Host "Stopping Upstream services..." -ForegroundColor Cyan
Write-Host ""

# Stop CoStar service (Python process on port 8765)
Write-Host "Stopping CoStar service..." -ForegroundColor Yellow
$costarProc = Get-NetTCPConnection -LocalPort 8765 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
if ($costarProc) {
    Stop-Process -Id $costarProc -Force -ErrorAction SilentlyContinue
    Write-Host "  CoStar service stopped" -ForegroundColor Green
} else {
    Write-Host "  CoStar service not running" -ForegroundColor Gray
}

# Stop Agent service (Python process on port 8766)
Write-Host "Stopping Agent service..." -ForegroundColor Yellow
$agentProc = Get-NetTCPConnection -LocalPort 8766 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
if ($agentProc) {
    Stop-Process -Id $agentProc -Force -ErrorAction SilentlyContinue
    Write-Host "  Agent service stopped" -ForegroundColor Green
} else {
    Write-Host "  Agent service not running" -ForegroundColor Gray
}

# Stop worker (Node.js process from apps/worker)
Write-Host "Stopping worker..." -ForegroundColor Yellow
$workerProcs = Get-Process -Name "node" -ErrorAction SilentlyContinue | Where-Object {
    $_.CommandLine -match "apps[/\\]worker" -or $_.MainWindowTitle -match "worker"
}
if ($workerProcs) {
    $workerProcs | Stop-Process -Force -ErrorAction SilentlyContinue
    Write-Host "  Worker stopped" -ForegroundColor Green
} else {
    # Try to find by pg-boss in command line
    $nodeProcs = Get-CimInstance Win32_Process -Filter "Name = 'node.exe'" | Where-Object {
        $_.CommandLine -match "worker"
    }
    if ($nodeProcs) {
        $nodeProcs | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }
        Write-Host "  Worker stopped" -ForegroundColor Green
    } else {
        Write-Host "  Worker not running" -ForegroundColor Gray
    }
}

# Stop web app (Next.js on port 3000)
Write-Host "Stopping web app..." -ForegroundColor Yellow
$webProc = Get-NetTCPConnection -LocalPort 3000 -ErrorAction SilentlyContinue | Select-Object -ExpandProperty OwningProcess -First 1
if ($webProc) {
    Stop-Process -Id $webProc -Force -ErrorAction SilentlyContinue
    Write-Host "  Web app stopped" -ForegroundColor Green
} else {
    Write-Host "  Web app not running" -ForegroundColor Gray
}

# Ask about Supabase
Write-Host ""
$stopSupabase = Read-Host "Stop Supabase too? (y/N)"
if ($stopSupabase -eq "y" -or $stopSupabase -eq "Y") {
    Write-Host "Stopping Supabase..." -ForegroundColor Yellow
    npx supabase stop
    Write-Host "  Supabase stopped" -ForegroundColor Green
}

Write-Host ""
Write-Host "All services stopped!" -ForegroundColor Green
