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
  # 截图脚本（shot.ps1）用的是旧 headless，两者视口与 GPU 行为不完全一致。
  # 需要"和截图同一个环境"时用 -Headless old。
  [ValidateSet('new', 'old')][string]$Headless = 'new',
  [string]$ShotName = ''
  ,
  # 在拖动/滚轮之后求值的表达式（用来验证"手势之后才发生的事"，比如音频自动播放）
  [string]$ExprLast = ''
  ,
  # 注入真实手指轨迹（CDP Input.dispatchTouchEvent），用 ; 分隔每一帧。
  #   单指："x,y;x,y;x,y"
  #   双指："x1,y1,x2,y2;x1,y1,x2,y2;..."（捏合 / 双指平移）
  # 用 ; 分隔（不用数组参数：外部 PowerShell 会把逗号数组拆成多个参数）
  [string]$TouchPath = '',
  # 中途改变视口（模拟旋屏 / 地址栏变化）："w,h"
  [string]$Resize = '',
  # 敲一下屏幕（走 Chrome 的手势识别）："x,y" —— 验证 tap 选中/聚焦
  [string]$Tap = '',
  # 滑动（走 Chrome 的手势识别）："x,y,dx,dy" —— dx/dy 是"内容滚动量"，
  # 手指方向与之相反（CDP 语义）。用来验证单指旋转 / 抽屉拖动。
  [string]$Swipe = '',
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
  "--headless=$Headless", '--no-sandbox', '--disable-gpu-sandbox', '--use-gl=angle',
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

  $touchPoints = @()
  if ($TouchPath) {
    $touchPoints = @($TouchPath.Split(';') | Where-Object { $_ -match ',' })
  }
  if ($touchPoints.Count -ge 2) {
    # 必须显式打开触摸仿真，否则 CDP 的 dispatchTouchEvent 会被 Chrome
    # 当成鼠标事件吞掉（表现为"拖动能动、轻点完全没反应"）。
    Send-Cdp -Method 'Emulation.setTouchEmulationEnabled' -Params @{
      enabled = $true; maxTouchPoints = 2
    } | Out-Null
    # 真实手指轨迹：touchStart → 逐帧 touchMove → touchEnd。
    # 每帧 2 个数字 = 单指；4 个数字 = 双指（捏合 / 双指平移）。
    function ConvertTo-TouchPoints([string]$frame) {
      $values = @($frame.Split(',') | ForEach-Object { [int]$_ })
      if ($values.Count -ge 4) {
        # 前置逗号：PowerShell 会把"只有一个元素的数组"摊平，必须显式包一层
        return ,@(
          @{ x = $values[0]; y = $values[1]; id = 1 },
          @{ x = $values[2]; y = $values[3]; id = 2 }
        )
      }
      return ,@(@{ x = $values[0]; y = $values[1]; id = 1 })
    }

    $startPoints = @(ConvertTo-TouchPoints $touchPoints[0])
    Write-Host ("touch start ({0} finger) -> {1} frames" -f $startPoints.Count, $touchPoints.Count) -ForegroundColor DarkGray
    Write-Host ("  points: " + ($startPoints | ForEach-Object { "($($_.x),$($_.y))" }) -join ' ') -ForegroundColor DarkGray
    Send-Cdp -Method 'Input.dispatchTouchEvent' -Params @{
      type = 'touchStart'; touchPoints = $startPoints
    } | Out-Null
    Start-Sleep -Milliseconds 30
    for ($i = 1; $i -lt $touchPoints.Count; $i++) {
      $framePoints = @(ConvertTo-TouchPoints $touchPoints[$i])
      Send-Cdp -Method 'Input.dispatchTouchEvent' -Params @{
        type = 'touchMove'; touchPoints = $framePoints
      } | Out-Null
      Start-Sleep -Milliseconds 22
    }
    Send-Cdp -Method 'Input.dispatchTouchEvent' -Params @{ type = 'touchEnd'; touchPoints = @() } | Out-Null
    Wait-Frames -Count 24
    Write-Host ("touch end   camera: {0}" -f (Get-Camera)) -ForegroundColor Yellow
  }

  if ($Tap) {
    # 走 Chrome 自己的手势识别：比手搓 touchStart/End 更接近真机的一次轻点
    $tapParts = $Tap.Split(',')
    $tapX = [int]$tapParts[0]
    $tapY = [int]$tapParts[1]
    Send-Cdp -Method 'Emulation.setTouchEmulationEnabled' -Params @{
      enabled = $true; maxTouchPoints = 2
    } | Out-Null
    Write-Host ("tap ({0},{1})" -f $tapX, $tapY) -ForegroundColor DarkGray
    Send-Cdp -Method 'Input.synthesizeTapGesture' -Params @{
      x = $tapX; y = $tapY; duration = 60; tapCount = 1
    } | Out-Null
    Wait-Frames -Count 24
    Write-Host ("tap result  camera: {0}" -f (Get-Camera)) -ForegroundColor Yellow
  }

  if ($Swipe) {
    # 与 -Tap 同源：走 Chrome 自己的手势识别，比手搓 touch 序列可靠得多
    $swipeParts = $Swipe.Split(',')
    $sx = [int]$swipeParts[0]
    $sy = [int]$swipeParts[1]
    $sdx = [int]$swipeParts[2]
    $sdy = [int]$swipeParts[3]
    Send-Cdp -Method 'Emulation.setTouchEmulationEnabled' -Params @{
      enabled = $true; maxTouchPoints = 2
    } | Out-Null
    $before = Get-Camera
    Write-Host ("swipe from ({0},{1}) scroll ({2},{3})" -f $sx, $sy, $sdx, $sdy) -ForegroundColor DarkGray
    Send-Cdp -Method 'Input.synthesizeScrollGesture' -Params @{
      x = $sx; y = $sy; xDistance = $sdx; yDistance = $sdy
      gestureSourceType = 'touch'; speed = 700; preventFling = $true
    } | Out-Null
    Wait-Frames -Count 30
    Write-Host ("swipe before: {0}" -f $before) -ForegroundColor DarkGray
    Write-Host ("swipe after : {0}" -f (Get-Camera)) -ForegroundColor Yellow
  }

  if ($Resize) {
    # 模拟旋屏：只改视口指标，页面不重新加载。
    # 用来验证 §24 —— focus 必须还在，Camera 不允许重建或复位。
    $parts = $Resize.Split(',')
    $rw = [int]$parts[0]
    $rh = [int]$parts[1]
    $beforeResize = Eval -Expression 'JSON.stringify({layout: document.querySelector(".atlas").dataset.layout, focus: window.__atlasStore.getState().focusKind + ":" + (window.__atlasStore.getState().focusId || "-"), cam: (function(){var c=window.__atlasCamera(); return {h: Math.round(c.height), x: c.x, z: c.z}})()})'
    Write-Host ("resize before  {0}" -f $beforeResize) -ForegroundColor DarkGray
    Send-Cdp -Method 'Emulation.setDeviceMetricsOverride' -Params @{
      width = $rw; height = $rh; deviceScaleFactor = 1; mobile = $true
    } | Out-Null
    Wait-Frames -Count 40
    $afterResize = Eval -Expression 'JSON.stringify({layout: document.querySelector(".atlas").dataset.layout, focus: window.__atlasStore.getState().focusKind + ":" + (window.__atlasStore.getState().focusId || "-"), cam: (function(){var c=window.__atlasCamera(); return {h: Math.round(c.height), x: c.x, z: c.z}})()})'
    Write-Host ("resize after   {0}" -f $afterResize) -ForegroundColor Yellow
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
