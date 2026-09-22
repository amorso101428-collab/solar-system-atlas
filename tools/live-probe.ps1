# Probe a *deployed* URL with headless Chrome (CDP over WebSocket, no npm deps).
# Unlike ui-probe.ps1 this does not start a local server - it points Chrome at
# the live site, so CSP headers and CDN behaviour are the real ones.
#
# Usage:
#   pwsh -File .\tools\live-probe.ps1 -Url https://example.com/ -Expr 'document.title'
#   pwsh -File .\tools\live-probe.ps1 -Url https://example.com/ -ErrProbe
#
# Needs PowerShell 7.
param(
  [Parameter(Mandatory = $true)][string]$Url,
  [string[]]$Expr = @(),
  [switch]$ErrProbe = $false,
  [string]$ShotName = '',
  [int]$DebugPort = 9355,
  [int]$Width = 1440,
  [int]$Height = 900,
  [int]$WaitSeconds = 12,
  # 用真实 GPU 而不是 SwiftShader 软件渲染（测帧率时用；软件渲染的数字没有参考价值）
  [switch]$UseGpu = $false,
  # 用真实窗口而不是无头模式（显卡选择与显示输出有关，无头会走另一条路径）。
  # 窗口位置移到屏幕外，所以不会打扰你。
  [switch]$Windowed = $false
)

$ErrorActionPreference = 'Stop'

$browser = @(
  'C:\Program Files\Google\Chrome\Application\chrome.exe',
  'C:\Program Files (x86)\Microsoft\Edge\Application\msedge.exe'
) | Where-Object { Test-Path $_ } | Select-Object -First 1
if (-not $browser) { throw 'Chrome / Edge not found.' }

$profile = Join-Path $env:TEMP ('atlas-live-' + [guid]::NewGuid().ToString('N').Substring(0, 8))
$glArgs = if ($UseGpu) {
  @('--use-angle=d3d11', '--enable-gpu', '--ignore-gpu-blocklist', '--enable-gpu-rasterization')
} else {
  @('--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader')
}
$chrome = Start-Process -FilePath $browser -ArgumentList (@(
  '--no-sandbox', '--disable-gpu-sandbox', '--disable-dev-shm-usage',
  '--no-first-run', '--log-level=3', '--autoplay-policy=no-user-gesture-required'
) + $(if ($Windowed) { @('--window-position=-32000,-32000') } else { @('--headless=new') }) + $glArgs + @(
  "--user-data-dir=$profile", "--window-size=$Width,$Height",
  "--remote-debugging-port=$DebugPort", $Url
)) -WindowStyle Hidden -PassThru

$ws = $null
try {
  $socketUrl = $null
  for ($i = 0; $i -lt 40; $i++) {
    Start-Sleep -Milliseconds 500
    try {
      $targets = Invoke-RestMethod -Uri "http://127.0.0.1:$DebugPort/json/list" -TimeoutSec 5
      $page = $targets | Where-Object { $_.type -eq 'page' -and $_.webSocketDebuggerUrl } | Select-Object -First 1
      if ($page) { $socketUrl = $page.webSocketDebuggerUrl; break }
    } catch { }
  }
  if (-not $socketUrl) { throw 'DevTools endpoint not reachable.' }

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
      $buffer = New-Object byte[] 4194304
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
    if ($reply.result.exceptionDetails) { return ('ERROR: ' + $reply.result.exceptionDetails.text) }
    return $reply.result.result.value
  }

  Send-Cdp -Method 'Page.enable' | Out-Null

  if ($ErrProbe) {
    $source = @'
window.__errs = [];
window.addEventListener('error', function (e) {
  window.__errs.push('ERR ' + (e.message || '') + ' @' + (e.filename || '') + ':' + (e.lineno || 0));
});
window.addEventListener('unhandledrejection', function (e) {
  window.__errs.push('REJ ' + String(e.reason));
});
window.addEventListener('securitypolicyviolation', function (e) {
  window.__errs.push('CSP ' + e.violatedDirective + ' blocked ' + String(e.blockedURI).slice(0, 90));
});
var ce = console.error;
console.error = function () {
  window.__errs.push('CONSOLE ' + Array.prototype.map.call(arguments, String).join(' ').slice(0, 420));
  ce.apply(console, arguments);
};
'@
    Send-Cdp -Method 'Page.addScriptToEvaluateOnNewDocument' -Params @{ source = $source } | Out-Null
    Send-Cdp -Method 'Page.reload' -Params @{ ignoreCache = $false } | Out-Null
  }

  Start-Sleep -Seconds $WaitSeconds
  Eval -Expression 'new Promise(r => { let n = 0; const f = () => { n++; if (n >= 30) r(n); else requestAnimationFrame(f) }; requestAnimationFrame(f) })' | Out-Null

  Write-Host ("== {0}" -f $Url) -ForegroundColor Cyan
  Write-Host ("   title: {0}" -f (Eval -Expression 'document.title')) -ForegroundColor DarkGray
  Write-Host ("   viewport: {0}x{1}" -f (Eval -Expression 'window.innerWidth'), (Eval -Expression 'window.innerHeight')) -ForegroundColor DarkGray

  if ($ErrProbe) {
    Write-Host ("ERRORS: " + (Eval -Expression 'JSON.stringify(window.__errs ? window.__errs.slice(0, 12) : "no-hook")')) -ForegroundColor Red
  }

  foreach ($expression in $Expr) {
    Write-Host ("EXPR  {0}" -f $expression) -ForegroundColor DarkGray
    Write-Host ("  ->  {0}" -f (Eval -Expression $expression)) -ForegroundColor Yellow
  }

  if ($ShotName) {
    $shots = Join-Path $PSScriptRoot 'shots'
    New-Item -ItemType Directory -Force -Path $shots | Out-Null
    $reply = Send-Cdp -Method 'Page.captureScreenshot' -Params @{ format = 'png' }
    $out = Join-Path $shots $ShotName
    [IO.File]::WriteAllBytes($out, [Convert]::FromBase64String($reply.result.data))
    Write-Host ("shot: {0}" -f $out) -ForegroundColor DarkGray
  }
}
finally {
  if ($ws) { try { $ws.Dispose() } catch { } }
  if ($chrome -and -not $chrome.HasExited) { Stop-Process -Id $chrome.Id -Force -ErrorAction SilentlyContinue }
  Start-Sleep -Milliseconds 500
  Get-Process -Name 'chrome', 'msedge' -ErrorAction SilentlyContinue |
    Where-Object { $_.Path -and $_.StartTime -gt $chrome.StartTime } |
    ForEach-Object { try { Stop-Process -Id $_.Id -Force -ErrorAction SilentlyContinue } catch { } }
}
