Write-Host "Starting test..."

Add-Type -AssemblyName System.Drawing

Write-Host "System.Drawing loaded"

try {
    Write-Host "Attempting to load dojak.png..."
    $src = [System.Drawing.Image]::FromFile("dojak.png")
    Write-Host "Image loaded successfully: $($src.Width) x $($src.Height)"
    $src.Dispose()
    Write-Host "Test completed successfully"
}
catch {
    Write-Host "ERROR: $($_.Exception.Message)"
    Write-Host "Stack trace: $($_.Exception.StackTrace)"
}
