# Headless UI probe (Chrome DevTools Protocol over WebSocket, no npm deps).
# Needs PowerShell 7 for ClientWebSocket.
#
# Usage:
#   pwsh -File .\tools\ui-probe.ps1 -Url 'index.html?view=atlas'
#   pwsh -File .\tools\ui-probe.ps1 -Url 'index.html?position=real' -Drag right
#   pwsh -File .\tools\ui-probe.ps1 -Url 'index.html?body=earth' -Expr 'document.querySelectorAll(".archive__listitem").length'
#
# Two jobs:
#   1. geometry  (default)  - dump the bounding boxes of the fixed UI boxes, which is
#                             how we prove the top bar does not move between states.
#   2. -Expr                - evaluate JS in the page and print the value.
#   3. -Drag left|right     - drag from the centre of the viewport, print the camera
#                             state before / during / after and PASS or FAIL the
#                             "the pose must stay after release" rule.
param(
  [string]$Url = 'index.html?view=atlas',
  [string[]]$Expr = @(),
  # 长脚本用文件传：表达式内容会被原样送进页面，避免命令行转义
  [string]$ExprFile = '',
  [string[]]$Selectors = @(
    '.topbar', '.topbar__left', '.topbar__scene', '.topbar__utility',
    '.masthead', '.backbtn', '.timeline', '.archive', '.catalogpanel'
  ),
  [ValidateSet('none', 'left', 'right')][string]$Drag = 'none',
  [int]$DragPx = 220,
  # 滚轮：正数放大、负数缩小（按浏览器惯例），配合 -WheelSteps 步进
  [int]$Wheel = 0,
  [int]$WheelSteps = 0,
  [int]$Port = 5221,
  [int]$DebugPort = 9344,
  [int]$Width = 1600,
  [int]$Height = 900,
  [int]$Frames = 45,
  [string]$ShotName = ''
  ,
  # 在拖动/滚轮之后求值的表达式（用来验证"手势之后才发生的事"，比如音频自动播放）
  [string]$ExprLast = ''
  ,
  # 抓运行时异常：注入采集器 → 重新加载 → 读出前若干条
  [switch]$ErrProbe = $false
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
$profile = Join-Path $env:TEMP ('atlas-probe-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
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

  $script:messageId = 0
  function Send-Cdp {
    param([string]$Method, [hashtable]$Params = @{})
    $script:messageId++
    $payload = @{ id = $script:messageId; method = $Method; params = $Params } | ConvertTo-Json -Depth 8 -Compress
    $bytes = [Text.Encoding]::UTF8.GetBytes($payload)
    $ws.SendAsync([ArraySegment[byte]]::new($bytes), [System.Net.WebSockets.WebSocketMessageType]::Text, $true, [Threading.CancellationToken]::None).Wait()
    while ($true) {
      $buffer = New-Object byte[] 2097152
      $result = $ws.ReceiveAsync([ArraySegment[byte]]::new($buffer), [Threading.CancellationToken]::None).Result
      $text = [Text.Encoding]::UTF8.GetString($buffer, 0, $result.Count)
      $json = $text | ConvertFrom-Json
      if ($json.id -eq $script:messageId) { return $json }
    }
  }

  function Eval {
    param([string]$Expression)
    $reply = Send-Cdp -Method 'Runtime.evaluate' -Params @{
      expression = $Expression
      returnByValue = $true
      awaitPromise = $true
    }
    if ($reply.result.exceptionDetails) { return ("ERROR: " + $reply.result.exceptionDetails.text) }
    return $reply.result.result.value
  }

  function Wait-Frames {
    param([int]$Count = 45)
    $expression = "new Promise(r => { let n = 0; const f = () => { n++; if (n >= $Count) r(n); else requestAnimationFrame(f) }; requestAnimationFrame(f) })"
    Eval -Expression $expression | Out-Null
  }

  function Get-Camera { return (Eval -Expression 'window.__atlasCamera ? JSON.stringify(window.__atlasCamera()) : "null"') }

  function Save-Shot {
    param([string]$Name)
    $shots = Join-Path $PSScriptRoot 'shots'
    New-Item -ItemType Directory -Force -Path $shots | Out-Null
    $reply = Send-Cdp -Method 'Page.captureScreenshot' -Params @{ format = 'png' }
    [IO.File]::WriteAllBytes((Join-Path $shots $Name), [Convert]::FromBase64String($reply.result.data))
    Write-Host ("shot: {0}" -f (Join-Path $shots $Name)) -ForegroundColor DarkGray
  }

  Start-Sleep -Seconds 2
  for ($i = 0; $i -lt 60; $i++) {
    if ((Eval -Expression 'document.querySelector(".topbar") ? 1 : 0') -eq 1) { break }
    Start-Sleep -Milliseconds 500
  }
  Send-Cdp -Method 'Page.enable' | Out-Null
  Wait-Frames -Count $Frames

  if ($ErrProbe) {
    $source = @'
window.__errs = [];
window.addEventListener('error', function (e) {
  window.__errs.push('ERR ' + (e.message || '') + ' @' + (e.filename || '') + ':' + (e.lineno || 0));
});
window.addEventListener('unhandledrejection', function (e) {
  window.__errs.push('REJ ' + String(e.reason));
});
var ce = console.error;
console.error = function () {
  window.__errs.push('CONSOLE ' + Array.prototype.map.call(arguments, String).join(' ').slice(0, 420));
  ce.apply(console, arguments);
};
'@
    Send-Cdp -Method 'Page.addScriptToEvaluateOnNewDocument' -Params @{ source = $source } | Out-Null
    Send-Cdp -Method 'Page.reload' -Params @{ ignoreCache = $false } | Out-Null
    Start-Sleep -Seconds 6
    Wait-Frames -Count 24
    Write-Host ("ERRORS: " + (Eval -Expression 'JSON.stringify(window.__errs ? window.__errs.slice(0, 10) : "no-hook")')) -ForegroundColor Red
  }

  Write-Host ("== {0}  viewport {1}x{2}" -f $Url, (Eval -Expression 'window.innerWidth'), (Eval -Expression 'window.innerHeight')) -ForegroundColor Cyan

  foreach ($expression in $Expr) {
    $value = Eval -Expression $expression
    Write-Host ("EXPR  {0}" -f $expression) -ForegroundColor DarkGray
    Write-Host ("  ->  {0}" -f $value) -ForegroundColor Yellow
  }

  if ($ExprFile) {
    $expression = Get-Content $ExprFile -Raw -Encoding UTF8
    Write-Host ("EXPRFILE  {0}" -f $ExprFile) -ForegroundColor DarkGray
    Write-Host ("  ->  {0}" -f (Eval -Expression $expression)) -ForegroundColor Yellow
  }

  if ($Expr.Count -eq 0 -and -not $ExprFile) {
    $selectorsJson = ($Selectors | ConvertTo-Json -Compress)
    $rectExpression = @"
JSON.stringify($selectorsJson.map(function (sel) {
  var el = document.querySelector(sel);
  if (!el) return { sel: sel, missing: true };
  var r = el.getBoundingClientRect();
  var st = getComputedStyle(el);
  return { sel: sel, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), display: st.display, opacity: st.opacity, visibility: st.visibility };
}))
"@
    $rects = Eval -Expression $rectExpression
    if ($rects) {
      ($rects | ConvertFrom-Json) | ForEach-Object {
        if ($_.missing) {
          Write-Host ("  {0,-18} MISSING" -f $_.sel) -ForegroundColor DarkGray
        } else {
          Write-Host ("  {0,-18} x={1,5} y={2,4} w={3,5} h={4,4} {5}" -f $_.sel, $_.x, $_.y, $_.w, $_.h, $_.display)
        }
      }
    }
  }

  if ($Drag -ne 'none') {
    $before = Get-Camera
    Write-Host ("camera before: {0}" -f $before) -ForegroundColor DarkGray
    $y = [int]($Height / 2)
    $x0 = [int]($Width / 2 - $DragPx / 2)
    $button = $Drag
    $buttons = if ($Drag -eq 'right') { 2 } else { 1 }
    Send-Cdp -Method 'Input.dispatchMouseEvent' -Params @{
      type = 'mousePressed'; x = $x0; y = $y; button = $button; buttons = $buttons; clickCount = 1
    } | Out-Null
    for ($i = 1; $i -le 12; $i++) {
      Send-Cdp -Method 'Input.dispatchMouseEvent' -Params @{
        type = 'mouseMoved'; x = ($x0 + [int]($DragPx * $i / 12)); y = $y; button = $button; buttons = $buttons
      } | Out-Null
      Start-Sleep -Milliseconds 40
    }
    $during = Get-Camera
    Send-Cdp -Method 'Input.dispatchMouseEvent' -Params @{
      type = 'mouseReleased'; x = ($x0 + $DragPx); y = $y; button = $button; buttons = 0; clickCount = 1
    } | Out-Null
    Wait-Frames -Count $Frames
    $after = Get-Camera
    Write-Host ("camera during: {0}" -f $during) -ForegroundColor DarkGray
    Write-Host ("camera after : {0}" -f $after) -ForegroundColor Yellow
    $b = $before | ConvertFrom-Json
    $a = $after | ConvertFrom-Json
    $moved = [Math]::Abs($a.yaw - $b.yaw) + [Math]::Abs($a.pitch - $b.pitch)
    if ($moved -gt 0.02) {
      Write-Host ("PASS: the drag changed the pose by {0:N3} rad and it stayed after release." -f $moved) -ForegroundColor Green
    } else {
      Write-Host 'FAIL: the pose snapped back to where it started.' -ForegroundColor Red
    }
  }

  if ($Wheel -ne 0 -and $WheelSteps -gt 0) {
    $before = Get-Camera
    Write-Host ("camera before wheel: {0}" -f $before) -ForegroundColor DarkGray
    $cx = [int]($Width / 2)
    $cy = [int]($Height / 2)
    for ($i = 0; $i -lt $WheelSteps; $i++) {
      Send-Cdp -Method 'Input.dispatchMouseEvent' -Params @{
        type = 'mouseWheel'; x = $cx; y = $cy; deltaX = 0; deltaY = $Wheel; button = 'none'; buttons = 0
      } | Out-Null
      Wait-Frames -Count 8
    }
    Wait-Frames -Count 30
    Write-Host ("camera after wheel : {0}" -f (Get-Camera)) -ForegroundColor Yellow
  }

  if ($ExprLast) {
    Write-Host ("EXPRLAST  {0}" -f (Eval -Expression $ExprLast)) -ForegroundColor Yellow
  }

  if ($ShotName) { Save-Shot -Name $ShotName }
} finally {
  if ($ws) { $ws.Dispose() }
  Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue
  Stop-Process -Id $server.Id -Force -ErrorAction SilentlyContinue
}
