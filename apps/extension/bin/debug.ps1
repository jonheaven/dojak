param(
    [Parameter(Mandatory=$true)]
    [string]$InputFile,
    
    [string]$OutDir = "icons",
    
    [int[]]$Sizes = @(16,19,32)
)

Write-Host "Debug: Starting IconGen..."

Add-Type -AssemblyName System.Drawing

function Ensure-OutDir {
    param([string]$Path)
    Write-Host "Debug: Ensuring output directory: $Path"
    if (-not (Test-Path $Path)) {
        Write-Host "Debug: Creating directory $Path"
        New-Item -ItemType Directory -Path $Path | Out-Null
    } else {
        Write-Host "Debug: Directory $Path already exists"
    }
}

function Load-Image {
    param([string]$Path)
    Write-Host "Debug: Loading image from: $Path"
    try {
        $img = [System.Drawing.Image]::FromFile($Path)
        Write-Host "Debug: Image loaded successfully: $($img.Width)x$($img.Height)"
        return $img
    }
    catch {
        Write-Host "ERROR: Cannot load input image: $Path - $($_.Exception.Message)"
        throw
    }
}

function Resize-Image {
    param([System.Drawing.Image]$Src, [int]$Size)
    Write-Host "Debug: Resizing image to ${Size}x${Size}"
    try {
        $bmp = New-Object System.Drawing.Bitmap $Size, $Size
        $gfx = [System.Drawing.Graphics]::FromImage($bmp)

        $gfx.InterpolationMode  = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $gfx.SmoothingMode      = [Drawing.Drawing2D.SmoothingMode]::HighQuality
        $gfx.PixelOffsetMode    = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $gfx.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality

        $gfx.DrawImage($Src, 0, 0, $Size, $Size)
        $gfx.Dispose()

        Write-Host "Debug: Resize completed for size $Size"
        return $bmp
    }
    catch {
        Write-Host "ERROR: Failed to resize image: $($_.Exception.Message)"
        throw
    }
}

function Save-Png {
    param([System.Drawing.Bitmap]$Bitmap, [string]$Path)
    Write-Host "Debug: Saving PNG to: $Path"
    try {
        $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
        Write-Host "Debug: PNG saved successfully: $Path"
    }
    catch {
        Write-Host "ERROR: Failed to save PNG: $Path - $($_.Exception.Message)"
        throw
    }
}

Write-Host "Debug: Calling Ensure-OutDir"
Ensure-OutDir $OutDir

Write-Host "Debug: Calling Load-Image"
$src = Load-Image $InputFile

Write-Host "Debug: Starting size loop with sizes: $($Sizes -join ', ')"
foreach ($size in $Sizes) {
    Write-Host "Debug: Processing size: $size"
    try {
        $bmp = Resize-Image -Src $src -Size $size
        $path = Join-Path $OutDir ("icon-{0}.png" -f $size)
        Save-Png -Bitmap $bmp -Path $path
        $bmp.Dispose()
        Write-Host "Created icon-$size.png"
    }
    catch {
        Write-Host "ERROR: Failed processing size $size : $($_.Exception.Message)"
        break
    }
}

$src.Dispose()
Write-Host "Debug: Script completed"
