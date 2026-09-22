# Left-drag pan self-check (no external dependencies: Chrome DevTools Protocol over WebSocket).
#
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\drag-test.ps1
#         powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\drag-test.ps1 -Url 'index.html?view=atlas'
#
# What it proves: in the side view, a left-drag must MOVE the camera target and the
# offset must STAY after the mouse is released (the bug was: CameraRig copied the base
# target back every frame, so the drag snapped home and stuttered).
#
# Requires the page to expose window.__atlasCamera(), which CameraRig installs when the
# URL carries ?debug=1 - the script appends it automatically.
#
# ASCII only: Windows PowerShell 5.1 reads .ps1 as ANSI, and a non-ASCII comment can
# swallow the end of its line. This script needs PowerShell 7 for ClientWebSocket.
param(
  [string]$Url = 'index.html?view=atlas',
  [int]$Port = 5211,
  [int]$DebugPort = 9333,
  [int]$Width = 1600,
  [int]$Height = 900,
  [int]$DragPx = 300,
  # 拖拽前后各存一张图，方便肉眼确认（默认开）
  [switch]$NoShot = $false
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$dist = Join-Path $root 'dist'
if (-not (Test-Path (Join-Path $dist 'index.html'))) { throw 'dist/index.html not found - run npm run build first.' }

$browser = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome / Edge not found.' }

$suffix = if ($Url -match '\?') { '&' } else { '?' }
$fullUrl = "http://127.0.0.1:$Port/$Url$suffix" + 'debug=1'

$server = Start-Process -FilePath 'python' -ArgumentList '-m', 'http.server', $Port, '--bind', '127.0.0.1' `
  -WorkingDirectory $dist -WindowStyle Hidden -PassThru
$profile = Join-Path $env:TEMP ('atlas-drag-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$chrome = Start-Process -FilePath $browser -ArgumentList @(
  '--headless=new', '--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle',
  '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--disable-dev-shm-usage',
  '--no-first-run', '--log-level=3', "--user-data-dir=$profile",
  "--window-size=$Width,$Height", "--remote-debugging-port=$DebugPort", $fullUrl
) -WindowStyle Hidden -PassThru

function Get-PageSocket {
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$DebugPort/json/list" -TimeoutSec 5
      $page = $targets | Where-Object { $_.type -eq 'page' -and $_.webSocketDebuggerUrl } | Select-Object -First 1
      if ($page) { return $page.webSocketDebuggerUrl }
    } catch { }
  }
  throw 'DevTools endpoint not reachable.'
}

try {
  $socketUrl = Get-PageSocket
  $ws = [System.Net.WebSockets.ClientWebSocket]::new()
  $ws.ConnectAsync([uri]$socketUrl, [Threading.CancellationToken]::None).Wait()
  Write-Host ("connected: {0}" -f $socketUrl) -ForegroundColor DarkGray

  $script:messageId = 0
  function Send-Cdp {
    param([string]$Method, [hashtable]$Params = @{})
    $script:messageId++
    $payload = @{ id = $script:messageId; method = $Method; params = $Params } | ConvertTo-Json -Depth 8 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $segment = [ArraySegment[byte]]::new($bytes)
    $ws.SendAsync($segment, [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
    # Read until the response with our id shows up
    while ($true) {
      $buffer = New-Object byte[] 1048576
      $result = $ws.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).Result
      $text = [Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
      $json = $text | ConvertFrom-Json
      if ($json.id -eq $script:messageId) { return $json }
    }
  }

  function Get-Camera {
    $reply = Send-Cdp -Method 'Runtime.evaluate' -Params @{
      expression = 'window.__atlasCamera ? JSON.stringify(window.__atlasCamera()) : "null"'
      returnByValue = $true
    }
    return $reply.result.result.value
  }

  function Get-Number {
    param([string]$Expression)
    $reply = Send-Cdp -Method 'Runtime.evaluate' -Params @{
      expression = $Expression
      returnByValue = $true
      awaitPromise = $true
    }
    return $reply.result.result.value
  }

  function Save-Shot {
    param([string]$Name)
    $shots = Join-Path $PSScriptRoot 'shots'
    New-Item -ItemType Directory -Force -Path $shots | Out-Null
    $reply = Send-Cdp -Method 'Page.captureScreenshot' -Params @{ format = 'png' }
    $path = Join-Path $shots $Name
    [IO.File]::WriteAllBytes($path, [Convert]::FromBase64String($reply.result.data))
    Write-Host ("shot: {0}" -f $path) -ForegroundColor DarkGray
  }

  # Headless software rendering runs rAF far below 60fps, so "read once and compare"
  # is meaningless: the damped camera is still moving. Step a fixed number of frames
  # instead - the number, not the wall clock, decides how settled the camera is.
  function Wait-Frames {
    param([int]$Frames = 60)
    $expression = "new Promise(r => { let n = 0; const f = () => { n++; if (n >= $Frames) r(n); else requestAnimationFrame(f) }; requestAnimationFrame(f) })"
    return Get-Number -Expression $expression
  }

  Start-Sleep -Seconds 3
  while ((Get-Camera) -eq 'null') { Start-Sleep -Milliseconds 500 }

  $viewportHeight = [double](Get-Number -Expression 'window.innerHeight')
  $fps = [double](Get-Number -Expression 'new Promise(r => { let n = 0; const t0 = performance.now(); const f = () => { n++; const dt = performance.now() - t0; if (dt > 1000) r(Math.round(n * 1000 / dt)); else requestAnimationFrame(f) }; requestAnimationFrame(f) })')
  Write-Host ("viewport {0}x{1}  (~{2} fps headless)" -f (Get-Number -Expression 'window.innerWidth'), $viewportHeight, $fps) -ForegroundColor DarkGray

  Wait-Frames -Frames 40 | Out-Null
  $before = Get-Camera | ConvertFrom-Json
  Write-Host ("before: target.x={0:N2} height={1:N2} offset.x={2:N2}" -f $before.x, $before.height, $before.offset[0])
  if (-not $NoShot) { Send-Cdp -Method 'Page.enable' | Out-Null; Save-Shot -Name 'drag-before.png' }

  $y = [int]($Height / 2)
  $x0 = [int]($Width / 2 - $DragPx / 2)
  Send-Cdp -Method 'Input.dispatchMouseEvent' -Params @{
    type = 'mousePressed'; x = $x0; y = $y; button = 'left'; buttons = 1; clickCount = 1
  } | Out-Null
  for ($i = 1; $i -le 12; $i++) {
    Send-Cdp -Method 'Input.dispatchMouseEvent' -Params @{
      type = 'mouseMoved'; x = ($x0 + [int]($DragPx * $i / 12)); y = $y; button = 'left'; buttons = 1
    } | Out-Null
    Start-Sleep -Milliseconds 40
  }
  $during = Get-Camera | ConvertFrom-Json
  Send-Cdp -Method 'Input.dispatchMouseEvent' -Params @{
    type = 'mouseReleased'; x = ($x0 + $DragPx); y = $y; button = 'left'; buttons = 0; clickCount = 1
  } | Out-Null
  Wait-Frames -Frames 40 | Out-Null
  $after = Get-Camera | ConvertFrom-Json
  if (-not $NoShot) { Save-Shot -Name 'drag-after.png' }

  Write-Host ("during: target.x={0:N2}  offset.x={1:N2}" -f $during.x, $during.offset[0]) -ForegroundColor Cyan
  Write-Host ("after : target.x={0:N2}  offset.x={1:N2}" -f $after.x, $after.offset[0]) -ForegroundColor Cyan

  # The atlas pans 1:1 with the pointer: dragging right by N px must move the target
  # LEFT by N * (visibleHeight / viewportHeight) world units, and it must stay there.
  $expected = $DragPx * ($after.height / $viewportHeight)
  $actual = $before.x - $after.x
  $offsetKept = [Math]::Abs($after.offset[0] + $expected)
  Write-Host ("expected pan ~ {0:N2} world units (drag {1}px); actual {2:N2}" -f $expected, $DragPx, $actual)
  Write-Host ("offset kept: {0:N2} (should be ~0)" -f $offsetKept)
  if ([Math]::Abs($actual - $expected) -lt ($expected * 0.2) -and $offsetKept -lt ($expected * 0.2)) {
    Write-Host 'PASS: the drag moved the view 1:1 and it stayed put after release.' -ForegroundColor Green
  } else {
    Write-Host 'FAIL: the view did not follow the drag, or it snapped back.' -ForegroundColor Red
  }
} finally {
  if ($ws) { $ws.Dispose() }
  Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
}
