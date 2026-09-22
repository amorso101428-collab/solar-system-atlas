# Pluto / Charon equirectangular textures.
#
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fetch-dwarf-textures.ps1
#         powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fetch-dwarf-textures.ps1 -Probe "Charon map"
#
# Output:
#   public/planets/pluto-2k.jpg    2048x1024 equirectangular map
#   public/moons/charon.jpg        2048x1024 equirectangular map
#
# Why this script exists: planets.ts used to point Pluto at planets/moon-2k.jpg (the
# Moon's map), and Charon was skipped by fetch-moon-textures.ps1 because the Commons
# sheet carries printed labels - so Charon only had a procedural surface.
#
# Source order:
#   1) Solar System Scope (CC BY 4.0 - same source as Mars / Saturn / the sun disc)
#   2) Wikimedia Commons keyword search (NASA / JHUAPL / SwRI New Horizons mosaics)
#   3) A curated Commons file, by exact title
#
# The New Horizons global maps are a latitude band on a black canvas (the flyby only
# imaged part of the sphere). Normalize-Band() finds the longest mostly-lit run of
# rows and stretches it to the full map, so the sphere shows no black holes.
#
# ASCII only: Windows PowerShell 5.1 reads .ps1 as ANSI, and a non-ASCII comment can
# swallow the end of its line - which silently merges the next statement into it.
param(
  [int]$Width = 2048,
  [string]$Probe = '',
  # -Force re-downloads even when the file is already present (use after tuning the
  # band detection: normalizing an already-normalized map would stretch it twice).
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
$userAgent = 'HumanArtifactsAtlas/6.0 (texture fetch for a non-commercial atlas; contact: local)'

$root = Split-Path -Parent $PSScriptRoot
$planetDir = Join-Path $root 'public\planets'
$moonDir = Join-Path $root 'public\moons'
New-Item -ItemType Directory -Force -Path $planetDir, $moonDir | Out-Null

function Save-Url {
  param([string]$Url, [string]$Target)
  # Download to .part first: a failed request must never destroy a good texture.
  $tmp = "$Target.part"
  try {
    Invoke-WebRequest -Uri $Url -UserAgent $userAgent -OutFile $tmp -TimeoutSec 90
    $length = (Get-Item $tmp).Length
    if ($length -lt 30000) {
      Remove-Item $tmp -Force
      Write-Host ("  --  too small ({0:n0} bytes)  {1}" -f $length, $Url) -ForegroundColor DarkGray
      return $false
    }
    Move-Item -LiteralPath $tmp -Destination $Target -Force
    Write-Host ("  OK  {0}  {1:n0} bytes  <- {2}" -f (Split-Path -Leaf $Target), $length, $Url) -ForegroundColor Green
    return $true
  } catch {
    if (Test-Path $tmp) { Remove-Item $tmp -Force }
    Write-Host ("  --  {0}  ({1})" -f $Url, $_.Exception.Message) -ForegroundColor DarkGray
    return $false
  }
}

function Get-CommonsPages {
  param([string]$Query)
  $api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&generator=search' +
    '&gsrnamespace=6&gsrlimit=15&prop=imageinfo&iiprop=url|size&iiurlwidth=' + $Width +
    '&gsrsearch=' + [uri]::EscapeDataString($Query)
  $data = Invoke-RestMethod -Uri $api -UserAgent $userAgent -TimeoutSec 90
  return @($data.query.pages.PSObject.Properties | ForEach-Object { $_.Value })
}

function Try-Sss {
  param([string]$Slug, [string]$Target)
  foreach ($url in @(
      "https://www.solarsystemscope.com/textures/download/2k_$Slug.jpg",
      "https://www.solarsystemscope.com/textures/download/2k_${Slug}_fictional.jpg")) {
    if (Save-Url -Url $url -Target $Target) { return $true }
  }
  return $false
}

function Try-Commons {
  param([string]$Query, [string]$Include, [string]$Target)
  try {
    $pages = Get-CommonsPages -Query $Query
  } catch {
    Write-Host ("  --  commons query failed: {0}" -f $_.Exception.Message) -ForegroundColor DarkGray
    return $false
  }
  foreach ($page in $pages) {
    if (-not $page.imageinfo) { continue }
    if ($page.title -notmatch $Include) { continue }
    if ($page.title -match 'grid|label|names|annotat|quadrangle|shaded') { continue }
    $info = $page.imageinfo[0]
    if ($info.height -le 0) { continue }
    $ratio = $info.width / $info.height
    if ($ratio -lt 1.7 -or $ratio -gt 2.35) { continue }
    $url = $info.thumburl
    if (-not $url) { $url = $info.url }
    if (Save-Url -Url $url -Target $Target) {
      Write-Host ("  source: {0}" -f $page.title) -ForegroundColor Green
      return $true
    }
  }
  return $false
}

function Try-CommonsFile {
  param([string]$FileTitle, [string]$Target)
  $api = 'https://commons.wikimedia.org/w/api.php?action=query&format=json&prop=imageinfo&iiprop=url|size' +
    '&iiurlwidth=' + $Width + '&titles=' + [uri]::EscapeDataString($FileTitle)
  try {
    $data = Invoke-RestMethod -Uri $api -UserAgent $userAgent -TimeoutSec 90
  } catch {
    Write-Host ("  --  commons title query failed: {0}" -f $_.Exception.Message) -ForegroundColor DarkGray
    return $false
  }
  $page = @($data.query.pages.PSObject.Properties | ForEach-Object { $_.Value })[0]
  if ($null -eq $page -or -not $page.imageinfo) { return $false }
  $info = $page.imageinfo[0]
  $url = $info.thumburl
  if (-not $url) { $url = $info.url }
  if (Save-Url -Url $url -Target $Target) {
    Write-Host ("  source: {0}" -f $page.title) -ForegroundColor Green
    return $true
  }
  return $false
}

function Resize-ToWidth {
  param([string]$Target, [int]$Width)
  if (-not (Test-Path $Target)) { return }
  Add-Type -AssemblyName System.Drawing
  $image = [System.Drawing.Image]::FromFile($Target)
  try {
    if ($image.Width -le $Width) {
      Write-Host ("  keep {0} ({1}x{2})" -f (Split-Path -Leaf $Target), $image.Width, $image.Height) -ForegroundColor DarkGray
      return
    }
    $newHeight = [int][Math]::Round($image.Height * ($Width / $image.Width))
    $bitmap = New-Object System.Drawing.Bitmap $Width, $newHeight
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.DrawImage($image, 0, 0, $Width, $newHeight)
    $graphics.Dispose()
    $image.Dispose()
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $params = New-Object System.Drawing.Imaging.EncoderParameters 1
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88
    $bitmap.Save("$Target.resized", $codec, $params)
    $bitmap.Dispose()
    Move-Item -LiteralPath "$Target.resized" -Destination $Target -Force
    Write-Host ("  resize -> {0}x{1}  {2}" -f $Width, $newHeight, (Split-Path -Leaf $Target)) -ForegroundColor Green
  } finally {
    if ($null -ne $image -and -not $image.Disposed) { $image.Dispose() }
  }
}

function Normalize-Band {
  param([string]$Target, [int]$MapWidth, [int]$MapHeight)
  if (-not (Test-Path $Target)) { return }
  Add-Type -AssemblyName System.Drawing
  $source = [System.Drawing.Bitmap]::FromFile($Target)
  try {
    $threshold = 18.0
    $stepX = [Math]::Max(1, [int]($source.Width / 256))
    $good = New-Object 'bool[]' $source.Height
    for ($y = 0; $y -lt $source.Height; $y++) {
      $n = 0
      $lit = 0
      for ($x = 0; $x -lt $source.Width; $x += $stepX) {
        $pixel = $source.GetPixel($x, $y)
        $luma = 0.299 * $pixel.R + 0.587 * $pixel.G + 0.114 * $pixel.B
        $n++
        if ($luma -gt $threshold) { $lit++ }
      }
      # 0.9 and not 0.6: the map's edge is jagged, so a row that is only 60% lit still
      # leaves a black fringe once the band is stretched to the full sphere.
      $good[$y] = ($n -gt 0 -and ($lit / $n) -ge 0.9)
    }
    $bestStart = 0
    $bestLen = 0
    $start = -1
    for ($y = 0; $y -lt $source.Height; $y++) {
      if ($good[$y]) {
        if ($start -lt 0) { $start = $y }
        if (($y - $start + 1) -gt $bestLen) {
          $bestLen = $y - $start + 1
          $bestStart = $start
        }
      } else {
        $start = -1
      }
    }
    if ($bestLen -le 0) {
      Write-Host ("  !! band not found: {0}" -f (Split-Path -Leaf $Target)) -ForegroundColor Red
      return
    }
    if ($bestLen -ge ($source.Height - 4) -and $source.Width -eq $MapWidth -and $source.Height -eq $MapHeight) {
      Write-Host ("  keep {0} (already full)" -f (Split-Path -Leaf $Target)) -ForegroundColor DarkGray
      return
    }
    Write-Host ("  band {0}: y {1}..{2} of {3} -> stretch to {4}x{5}" -f `
        (Split-Path -Leaf $Target), $bestStart, ($bestStart + $bestLen - 1), $source.Height, $MapWidth, $MapHeight) -ForegroundColor Green
    $canvas = New-Object System.Drawing.Bitmap $MapWidth, $MapHeight
    $graphics = [System.Drawing.Graphics]::FromImage($canvas)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $destination = New-Object System.Drawing.Rectangle 0, 0, $MapWidth, $MapHeight
    $band = New-Object System.Drawing.Rectangle 0, $bestStart, $source.Width, $bestLen
    $graphics.DrawImage($source, $destination, $band, [System.Drawing.GraphicsUnit]::Pixel)
    $graphics.Dispose()
    $source.Dispose()
    $codec = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
    $params = New-Object System.Drawing.Imaging.EncoderParameters 1
    $params.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), 88
    $canvas.Save("$Target.band", $codec, $params)
    $canvas.Dispose()
    Move-Item -LiteralPath "$Target.band" -Destination $Target -Force
  } finally {
    if ($null -ne $source -and -not $source.Disposed) { $source.Dispose() }
  }
}

if ($Probe) {
  foreach ($page in (Get-CommonsPages -Query $Probe)) {
    if (-not $page.imageinfo) { continue }
    $info = $page.imageinfo[0]
    $ratio = if ($info.height -gt 0) { $info.width / $info.height } else { 0 }
    Write-Host ("{0,6:N2}  {1,5}x{2,-5}  {3}" -f $ratio, $info.width, $info.height, $page.title)
  }
  return
}

Write-Host 'Pluto ->' -ForegroundColor Cyan
$pluto = Join-Path $planetDir 'pluto-2k.jpg'
if ((-not $Force) -and (Test-Path $pluto) -and (Get-Item $pluto).Length -gt 30000) {
  Write-Host '  skip (already present)' -ForegroundColor DarkGray
} elseif (Try-Sss -Slug 'pluto' -Target $pluto) {
} elseif (Try-Commons -Query 'Pluto global mosaic map New Horizons' -Include 'pluto' -Target $pluto) {
} elseif (Try-CommonsFile -FileTitle 'File:Pluto color mapmosaic.jpg' -Target $pluto) {
} else {
  Write-Host '  !! Pluto texture not fetched' -ForegroundColor Red
}

Write-Host 'Charon ->' -ForegroundColor Cyan
$charon = Join-Path $moonDir 'charon.jpg'
if ((-not $Force) -and (Test-Path $charon) -and (Get-Item $charon).Length -gt 30000) {
  Write-Host '  skip (already present)' -ForegroundColor DarkGray
} elseif (Try-Sss -Slug 'charon' -Target $charon) {
} elseif (Try-Commons -Query 'Charon global mosaic map New Horizons' -Include 'charon' -Target $charon) {
} elseif (Try-CommonsFile -FileTitle 'File:Charon map iau1803c.jpg' -Target $charon) {
} else {
  Write-Host '  !! Charon texture not fetched' -ForegroundColor Red
}

Resize-ToWidth -Target $pluto -Width $Width
Resize-ToWidth -Target $charon -Width $Width
Normalize-Band -Target $pluto -MapWidth $Width -MapHeight ($Width / 2)
Normalize-Band -Target $charon -MapWidth $Width -MapHeight ($Width / 2)

Get-ChildItem $pluto, $charon -ErrorAction SilentlyContinue | Select-Object Name, Length
