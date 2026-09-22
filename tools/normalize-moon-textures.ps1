# Normalize the downloaded lunar/planetary mosaics into usable equirectangular maps.
# Usage: powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\normalize-moon-textures.ps1
#
# Some NASA/JPL/USGS products are not full-sphere maps:
#   * Voyager-era maps (Europa, Ganymede, Callisto, Rhea, Uranian moons) are a single
#     latitude band on a black canvas  -> trim the black canvas, then stretch to 2:1
#   * Cassini "Map of ..." sheets carry a caption, a graticule frame and a scale bar
#     -> crop inside the frame with a fixed inset
# Everything is written back as 2048x1024, which is what the atlas samples.
#
# ASCII only: Windows PowerShell 5.1 reads .ps1 as ANSI.
param(
  [int]$Width = 2048,
  [int]$Height = 1024
)

$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

$root = Split-Path -Parent $PSScriptRoot
$dir = Join-Path $root 'public\moons'

# id -> 'trim' (auto-trim black canvas) | 'l,t,r,b' insets as fractions | 'keep'
$plan = [ordered]@{
  'io'        = 'trim'
  'europa'    = 'trim'
  'ganymede'  = 'trim'
  'callisto'  = 'trim'
  'rhea'      = 'trim'
  'phoebe'    = 'trim'
  'triton'    = 'trim'
  'miranda'   = 'trim'
  'ariel'     = 'trim'
  'umbriel'   = 'trim'
  'titania'   = 'trim'
  'oberon'    = 'trim'
  'mimas'     = '0.055,0.115,0.055,0.135'
  'enceladus' = '0.045,0.055,0.045,0.115'
  'tethys'    = '0.045,0.075,0.045,0.120'
  'dione'     = '0.045,0.075,0.045,0.120'
  'titan'     = 'keep'
  'phobos'    = 'keep'
  'charon'    = 'keep'
}

function Get-Luma([System.Drawing.Bitmap]$bmp, [int]$x, [int]$y, [int]$w, [int]$h, [bool]$row) {
  # average luminance of one border line, sampled at most every 8px
  $sum = 0.0; $n = 0
  $step = 8
  if ($row) {
    for ($i = $x; $i -lt ($x + $w); $i += $step) {
      $c = $bmp.GetPixel($i, $y); $sum += (0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B); $n++
    }
  } else {
    for ($j = $y; $j -lt ($y + $h); $j += $step) {
      $c = $bmp.GetPixel($x, $j); $sum += (0.299 * $c.R + 0.587 * $c.G + 0.114 * $c.B); $n++
    }
  }
  if ($n -eq 0) { return 0 }
  return $sum / $n
}

function Get-TrimRect([System.Drawing.Bitmap]$bmp) {
  $threshold = 14.0
  $w = $bmp.Width; $h = $bmp.Height
  $top = 0; $bottom = $h - 1; $left = 0; $right = $w - 1
  while ($top -lt $h - 1 -and (Get-Luma $bmp 0 $top $w 1 $true) -le $threshold) { $top += 2 }
  while ($bottom -gt $top + 1 -and (Get-Luma $bmp 0 $bottom $w 1 $true) -le $threshold) { $bottom -= 2 }
  while ($left -lt $w - 1 -and (Get-Luma $bmp $left 0 1 $h $false) -le $threshold) { $left += 2 }
  while ($right -gt $left + 1 -and (Get-Luma $bmp $right 0 1 $h $false) -le $threshold) { $right -= 2 }
  return New-Object System.Drawing.Rectangle($left, $top, ($right - $left + 1), ($bottom - $top + 1))
}

foreach ($entry in $plan.GetEnumerator()) {
  $id = $entry.Key; $mode = $entry.Value
  $file = Join-Path $dir "$id.jpg"
  if (-not (Test-Path $file)) { continue }

  $source = [System.Drawing.Bitmap]::FromFile($file)
  try {
    if ($mode -eq 'keep') {
      $rect = New-Object System.Drawing.Rectangle(0, 0, $source.Width, $source.Height)
    } elseif ($mode -eq 'trim') {
      $rect = Get-TrimRect $source
      $before = "{0}x{1}" -f $source.Width, $source.Height
      Write-Host ("  {0,-10} trim {1} -> {2}x{3}" -f $id, $before, $rect.Width, $rect.Height)
    } else {
      $parts = $mode.Split(',')
      $l = [int]([double]$parts[0] * $source.Width)
      $t = [int]([double]$parts[1] * $source.Height)
      $r = [int]([double]$parts[2] * $source.Width)
      $b = [int]([double]$parts[3] * $source.Height)
      $rect = New-Object System.Drawing.Rectangle($l, $t, ($source.Width - $l - $r), ($source.Height - $t - $b))
      Write-Host ("  {0,-10} crop -> {1}x{2}" -f $id, $rect.Width, $rect.Height)
    }

    $target = New-Object System.Drawing.Bitmap($Width, $Height, [System.Drawing.Imaging.PixelFormat]::Format24bppRgb)
    $graphics = [System.Drawing.Graphics]::FromImage($target)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($source, (New-Object System.Drawing.Rectangle(0, 0, $Width, $Height)), $rect, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()

    $source.Dispose()
    $tmp = Join-Path $dir "$id.tmp.jpg"
    $target.Save($tmp, [System.Drawing.Imaging.ImageFormat]::Jpeg)
    $target.Dispose()
    Move-Item -LiteralPath $tmp -Destination $file -Force
  } finally {
    if (-not $source.Disposed) { }
  }
}

Write-Host 'normalized -> public/moons/*.jpg (2048x1024)' -ForegroundColor Cyan
