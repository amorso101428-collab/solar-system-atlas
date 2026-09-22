# Generate downscaled texture tiers for the mobile/tablet render profiles.
#
#   public/planets/earth_daymap-2k.jpg  ->  earth_daymap-1k.jpg (1024 wide)
#                                       ->  earth_daymap-512.jpg (512 wide)
#
# Why: the atlas uploads ~20 equirect textures. At 2048x1024 with mipmaps that is
# roughly 220 MB of GPU memory - fine on a desktop, risky on an iPhone (WebGL
# context loss). V1.1 §18/§19 asks for a texture quality ladder; the cheapest
# honest implementation is "ship smaller tiers, pick one at load time".
#
# The originals are never touched. Re-running only rebuilds stale outputs.
#
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File tools/make-texture-tiers.ps1
param(
  [int]$JpegQuality = 88,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$publicDir = Join-Path $root 'public'
# Only tier the textures that actually get uploaded to the GPU
# (planets / moons / rings). public/images are plain <img> photos in the
# dossiers - they never occupy VRAM, so they must not bloat the repo.
# NOTE: ASCII only - Windows PowerShell 5.1 reads .ps1 as ANSI.
$textureDirs = @('planets', 'moons', 'textures') | ForEach-Object { Join-Path $publicDir $_ }
$tiers = @(
  @{ suffix = '-1k'; width = 1024 },
  @{ suffix = '-512'; width = 512 }
)

$jpegCodec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() |
  Where-Object { $_.MimeType -eq 'image/jpeg' }
$jpegParams = New-Object System.Drawing.Imaging.EncoderParameters(1)
$jpegParams.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter(
  [System.Drawing.Imaging.Encoder]::Quality, [int]$JpegQuality
)

function Get-TierName([string]$file, [string]$suffix) {
  $dir = Split-Path -Parent $file
  $ext = [System.IO.Path]::GetExtension($file)
  $base = [System.IO.Path]::GetFileNameWithoutExtension($file)
  # earth_daymap-2k -> earth_daymap ; io -> io
  $base = $base -replace '-2k$', ''
  return (Join-Path $dir ($base + $suffix + $ext))
}

$made = 0
$skipped = 0
$sources = $textureDirs |
  Where-Object { Test-Path $_ } |
  ForEach-Object { Get-ChildItem -LiteralPath $_ -File } |
  Where-Object { $_.Extension -match '^\.(jpg|jpeg|png)$' -and $_.Name -notmatch '-1k\.|-512\.' }

foreach ($file in $sources) {
  $image = [System.Drawing.Image]::FromFile($file.FullName)
  try {
    if ($image.Width -lt 1024) { continue }
    foreach ($tier in $tiers) {
      $target = Get-TierName $file.FullName $tier.suffix
      if ((Test-Path $target) -and -not $Force) {
        if ((Get-Item $target).LastWriteTime -ge $file.LastWriteTime) {
          $skipped++
          continue
        }
      }
      $width = [int]$tier.width
      $height = [int][Math]::Round($image.Height * ($width / $image.Width))
      $bitmap = New-Object System.Drawing.Bitmap($width, $height)
      $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
      try {
        $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
        $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
        $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
        $graphics.DrawImage($image, 0, 0, $width, $height)
      } finally {
        $graphics.Dispose()
      }
      if ([System.IO.Path]::GetExtension($target) -match '^\.(jpg|jpeg)$') {
        $bitmap.Save($target, $jpegCodec, $jpegParams)
      } else {
        $bitmap.Save($target, [System.Drawing.Imaging.ImageFormat]::Png)
      }
      $bitmap.Dispose()
      $made++
    }
  } finally {
    $image.Dispose()
  }
}

$tier1 = $textureDirs | Where-Object { Test-Path $_ } | ForEach-Object { Get-ChildItem -LiteralPath $_ -File -Filter '*-1k.*' }
$tier2 = $textureDirs | Where-Object { Test-Path $_ } | ForEach-Object { Get-ChildItem -LiteralPath $_ -File -Filter '*-512.*' }
Write-Host ("texture tiers: built {0}, up-to-date {1}" -f $made, $skipped) -ForegroundColor Green
Write-Host ("  *-1k.*  : {0} files, {1:N1} MB" -f $tier1.Count, (($tier1 | Measure-Object -Property Length -Sum).Sum / 1MB))
Write-Host ("  *-512.* : {0} files, {1:N1} MB" -f $tier2.Count, (($tier2 | Measure-Object -Property Length -Sum).Sum / 1MB))
