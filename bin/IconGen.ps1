<#
IconGen.ps1 - Generate browser extension icons + favicon from one image.

Usage:
    .\IconGen.ps1 -InputFile "logo.png"
    .\IconGen.ps1 -InputFile "logo.png" -OutDir "icons" -Sizes 16,32,48,128
#>

param(
    [Parameter(Mandatory=$true)]
    [string]$InputFile,

    [string]$OutDir = "icons",

    [int[]]$Sizes = @(16,19,32,38,48,64,96,128,256)
)

# Load System.Drawing
Add-Type -AssemblyName System.Drawing

function Ensure-OutDir {
    param([string]$Path)
    if (-not (Test-Path $Path)) {
        New-Item -ItemType Directory -Path $Path | Out-Null
    }
}

function Load-Image {
    param([string]$Path)
    try {
        return [System.Drawing.Image]::FromFile($Path)
    }
    catch {
        Write-Host "ERROR: Cannot load input image: $Path"
        exit 1
    }
}

function Resize-Image {
    param(
        [System.Drawing.Image]$Src,
        [int]$Size
    )

    $bmp = New-Object System.Drawing.Bitmap $Size, $Size
    $gfx = [System.Drawing.Graphics]::FromImage($bmp)

    $gfx.InterpolationMode  = [Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $gfx.SmoothingMode      = [Drawing.Drawing2D.SmoothingMode]::HighQuality
    $gfx.PixelOffsetMode    = [Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $gfx.CompositingQuality = [Drawing.Drawing2D.CompositingQuality]::HighQuality

    $gfx.DrawImage($Src, 0, 0, $Size, $Size)
    $gfx.Dispose()

    return $bmp
}

function Save-Png {
    param(
        [System.Drawing.Bitmap]$Bitmap,
        [string]$Path
    )
    $Bitmap.Save($Path, [System.Drawing.Imaging.ImageFormat]::Png)
}

function Build-Favicon {
    param(
        [string]$OutDir,
        [int[]]$Sizes
    )

    $icoPath = Join-Path $OutDir "favicon.ico"
    Ensure-OutDir $OutDir

    try {
        $fs = [System.IO.File]::Create($icoPath)
    }
    catch {
        Write-Host "ERROR: Could not create favicon: $icoPath"
        return
    }

    $count = $Sizes.Count
    $header = [byte[]](0,0,1,0,$count,0)
    $fs.Write($header, 0, 6)

    $offset = 6 + ($count * 16)
    $images = @()

    foreach ($size in $Sizes) {
        $path = Join-Path $OutDir ("icon-{0}.png" -f $size)
        if (!(Test-Path $path)) { continue }

        $bytes = [IO.File]::ReadAllBytes($path)
        $images += @( $bytes )

        $entry = New-Object byte[] 16
        $entry[0] = [byte]$size
        $entry[1] = [byte]$size
        $entry[2] = 0
        $entry[3] = 0
        $entry[4] = 1
        $entry[5] = 0
        $entry[6] = 32
        $entry[7] = 0
        [BitConverter]::GetBytes($bytes.Length).CopyTo($entry, 8)
        [BitConverter]::GetBytes($offset).CopyTo($entry, 12)

        $fs.Write($entry, 0, 16)
        $offset += $bytes.Length
    }

    foreach ($bytes in $images) {
        $fs.Write($bytes, 0, $bytes.Length)
    }

    $fs.Close()
    Write-Host "Created favicon.ico"
}

# ------------------------------
# MAIN
# ------------------------------

Write-Host "IconGen - Generating icons..."

Ensure-OutDir $OutDir
$src = Load-Image $InputFile

foreach ($size in $Sizes) {
    $bmp = Resize-Image -Src $src -Size $size
    $path = Join-Path $OutDir ("icon-{0}.png" -f $size)
    Save-Png -Bitmap $bmp -Path $path
    $bmp.Dispose()
    Write-Host "Created icon-$size.png"
}

# Build favicon using 16, 32, 48 px
Build-Favicon -OutDir $OutDir -Sizes @(16,32,48)

Write-Host "All icons generated."
Write-Host "Output folder: $OutDir"
