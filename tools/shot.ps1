# Headless screenshot self-check (ASCII only; Windows PowerShell 5.1 reads .ps1 as ANSI).
# Usage:
#   .\tools\shot.ps1 -Urls @('index.html','index.html?object=voyager-1') -Port 5181
# Serve the built dist/ folder and capture one PNG per URL into tools/shots/.
param(
  [string[]]$Urls = @('index.html', 'index.html?object=voyager-1'),
  [int]$Port = 5181,
  [int]$Width = 1600,
  [int]$Height = 900,
  [int]$Budget = 12000
)

$ErrorActionPreference = 'Continue'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
$shots = Join-Path $PSScriptRoot 'shots'
New-Item -ItemType Directory -Force -Path $shots | Out-Null

if (-not (Test-Path (Join-Path $dist 'index.html'))) { throw 'dist/index.html not found - run npm run build first.' }

$browser = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome / Edge not found.' }

$srv = Start-Process -FilePath 'python' -ArgumentList '-m', 'http.server', $Port, '--bind', '127.0.0.1' -WorkingDirectory $dist -WindowStyle Hidden -PassThru
Start-Sleep -Seconds 2

try {
  $index = 0
  foreach ($url in $Urls) {
    $index++
    # v7.2: the boot overlay would cover every self-check shot, so skip it by
    # default (keep the URL untouched when it already sets boot=).
    if ($url -notmatch 'boot=') {
      $url += ($(if ($url -match '\?') { '&' } else { '?' }) + 'boot=0')
    }
    $name = ('shot-{0:d2}.png' -f $index)
    $out = Join-Path $shots $name
    $profile = Join-Path $env:TEMP ('atlas-shot-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
    $full = "http://127.0.0.1:$Port/$url"

    & $browser --headless=old --no-sandbox --disable-gpu-sandbox --use-gl=angle --use-angle=swiftshader --enable-unsafe-swiftshader --disable-dev-shm-usage --no-first-run --log-level=3 --user-data-dir="$profile" --window-size="$Width,$Height" --virtual-time-budget=$Budget --screenshot="$out" $full 2>&1 | Out-Null

    if (Test-Path $out) {
      Write-Host ("OK   {0}  {1} bytes  <- {2}" -f $name, (Get-Item $out).Length, $url) -ForegroundColor Green
    } else {
      Write-Host ("FAIL {0}  <- {1}" -f $name, $url) -ForegroundColor Red
    }
  }
} finally {
  Stop-Process -Id $srv.Id -Force
}
