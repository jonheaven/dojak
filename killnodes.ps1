function killnodes {
    Write-Host "Killing all Node.js processes..." -ForegroundColor Yellow
    
    # Get all node.exe processes
    $nodeProcesses = Get-Process node -ErrorAction SilentlyContinue
    
    if ($nodeProcesses) {
        $nodeProcesses | ForEach-Object {
            Write-Host "Killing Node.js process (PID: $($_.Id), Command: $($_.CommandLine))" -ForegroundColor Red
            Stop-Process -Id $_.Id -Force
        }
        Write-Host "All Node.js processes killed successfully!" -ForegroundColor Green
    } else {
        Write-Host "No Node.js processes found running." -ForegroundColor Cyan
    }
    
    # Also kill any webpack dev servers or related processes
    $webpackProcesses = Get-Process | Where-Object { $_.ProcessName -match "webpack|npm|yarn" -and $_.CommandLine -match "dev|start|serve" } -ErrorAction SilentlyContinue
    
    if ($webpackProcesses) {
        Write-Host "
Also killing development server processes..." -ForegroundColor Yellow
        $webpackProcesses | ForEach-Object {
            Write-Host "Killing development process (PID: $($_.Id), Name: $($_.ProcessName))" -ForegroundColor Red
            Stop-Process -Id $_.Id -Force
        }
    }
}
