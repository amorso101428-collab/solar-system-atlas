# Natural-satellite textures from Wikimedia Commons (NASA / JPL / USGS global mosaics).
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fetch-moon-textures.ps1
#
# Output:
#   public/moons/<id>.jpg        equirectangular global mosaic, downsampled to 2048px wide
#   src/data/moon-credits.json   attribution list (no source, no asset)
#
# Every source below is a public-domain NASA / JPL-Caltech / USGS product, except Charon
# (NASA/JHUAPL/SwRI, CC BY 4.0). Existing files are never overwritten.
param(
  [int]$Width = 2048,
  [int]$DelayMs = 3500,
  [switch]$Force
)

$ErrorActionPreference = 'Stop'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ProgressPreference = 'SilentlyContinue'
# Wikimedia rate-limits generic clients hard; a descriptive UA plus pacing keeps it polite.
$userAgent = 'HumanArtifactsAtlas/4.0 (texture fetch for a non-commercial atlas; contact: local)'

$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'public\moons'
$creditFile = Join-Path $root 'src\data\moon-credits.json'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

# id, commons file, body, credit, license
# Only full-sphere maps ship: the Voyager coverage of the Uranian moons is a lens-shaped
# band (black corners once wrapped), and the Phobos / Charon sheets carry printed labels,
# so those bodies keep their procedural surface instead.
$assets = @(
  @('io',        'Io map projection PIA00319.jpg',                     'Io',        'NASA/JPL/USGS',                            'Public domain'),
  @('europa',    'Jupiter II-Europa map NASA JPL Voyager.jpg',         'Europa',    'Caltech/JPL/USGS',                         'Public domain'),
  @('ganymede',  'Ganymede map NASA JPL Voyager.jpg',                  'Ganymede',  'Caltech/JPL/USGS',                         'Public domain'),
  @('callisto',  'Callisto map NASA JPL Voyager.jpg',                  'Callisto',  'Caltech/JPL/USGS',                         'Public domain'),
  @('mimas',     'Map of Mimas 2010-02 PIA12780.jpg',                  'Mimas',     'NASA/JPL/Space Science Institute',          'Public domain'),
  @('enceladus', 'Map of Enceladus PIA 14937 Dec 2011.jpg',            'Enceladus', 'NASA/JPL/Space Science Institute',          'Public domain'),
  @('tethys',    'Map of Tethys PIA 14931 Jun 2012.jpg',               'Tethys',    'NASA/JPL/Space Science Institute',          'Public domain'),
  @('dione',     'Dione map 2011 PIA14914.jpg',                        'Dione',     'NASA/JPL/Space Science Institute',          'Public domain'),
  @('rhea',      'Rhea map NASA JPL Voyager.jpg',                      'Rhea',      'Caltech/JPL/USGS',                         'Public domain'),
  @('titan',     'Map of Titan cropped.jpg',                           'Titan',     'NASA/JPL/Space Science Institute',          'Public domain'),
  @('phoebe',    'Phoebe map PIA07775 cropped.jpg',                    'Phoebe',    'NASA/JPL/Space Science Institute',          'Public domain'),
  @('triton',    'Triton map no grid.jpg',                             'Triton',    'NASA/JPL (Voyager 2), mosaic by P. Schenk / LPI', 'Public domain')
)

$credits = [ordered]@{}
foreach ($asset in $assets) {
  $id = $asset[0]; $file = $asset[1]; $body = $asset[2]; $credit = $asset[3]; $license = $asset[4]
  $target = Join-Path $outDir "$id.jpg"

  $credits[$id] = [ordered]@{
    body    = $body
    source  = "Wikimedia Commons - File:$file"
    credit  = $credit
    license = $license
    usage   = 'texture (equirectangular global mosaic, downsampled)'
  }

  if ((Test-Path $target) -and -not $Force) {
    Write-Host ("  skip {0}.jpg" -f $id) -ForegroundColor DarkGray
    continue
  }

  $done = $false
  for ($attempt = 1; $attempt -le 4 -and -not $done; $attempt++) {
    try {
      # Special:FilePath on commons.wikimedia.org (the thumbnail CDN throttles scripts harder).
      # Keep this file ASCII-only: Windows PowerShell 5.1 reads .ps1 as ANSI.
      $url = "https://commons.wikimedia.org/wiki/Special:FilePath/" +
        [uri]::EscapeDataString($file) + "?width=$Width"
      Invoke-WebRequest -Uri $url -OutFile $target -TimeoutSec 300 -UseBasicParsing -UserAgent $userAgent
      $size = (Get-Item $target).Length
      if ($size -lt 8000) { throw "file too small ($size B)" }
      Write-Host ("  ok   {0}.jpg  {1} KB" -f $id, [int]($size / 1024)) -ForegroundColor Green
      $done = $true
    } catch {
      if (Test-Path $target) { Remove-Item -LiteralPath $target -Force }
      if ($attempt -lt 4) {
        Start-Sleep -Seconds (6 * $attempt)
      } else {
        $credits.Remove($id)
        Write-Host ("  fail {0}: {1}" -f $id, $_.Exception.Message) -ForegroundColor Red
      }
    }
  }
  Start-Sleep -Milliseconds $DelayMs
}

($credits | ConvertTo-Json -Depth 5) | Set-Content -LiteralPath $creditFile -Encoding UTF8
Write-Host ("credits -> {0}" -f $creditFile) -ForegroundColor Cyan
