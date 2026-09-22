# Fetch the full melodysheep album for the in-site music hall (v8.1).
#
# Why this exists: the music hall lists and plays the WHOLE album, and the
# album's stream URLs carry per-visit tokens, so they cannot be hardcoded.
# This script re-reads the album page, downloads the audio into
# public/audio/music/ and rewrites album.json.
#
# License: the album page marks every track as
# "Attribution Non Commercial Share Alike" and this project is non-commercial,
# so redistribution with attribution is allowed. See public/audio/ATTRIBUTIONS.md.
#
# Usage:  powershell -NoProfile -ExecutionPolicy Bypass -File .\tools\fetch-album.ps1
#         ... -Force        (re-download everything)
#
# ASCII only: Windows PowerShell 5.1 reads .ps1 as ANSI.
param(
  [switch]$Force,
  # 只刷新 album.json（曲目与在线流地址），不下载任何音频（v8.2：项目不再打包音乐）
  [switch]$ManifestOnly
)

$ErrorActionPreference = 'Stop'
$root = Split-Path -Parent $PSScriptRoot
$outDir = Join-Path $root 'public\audio\music'
New-Item -ItemType Directory -Force -Path $outDir | Out-Null

$albumUrl = 'https://melodysheep.bandcamp.com/album/the-arrow-of-time-soundtrack-to-timelapse-of-the-future'
$albumTitle = 'The Arrow of Time: Soundtrack to Timelapse of the Future'
$headers = @{ 'User-Agent' = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) HumanArtifactsAtlas/8.1' }

Write-Host 'fetching album page...' -ForegroundColor DarkGray
$response = Invoke-WebRequest -Uri $albumUrl -Headers $headers -TimeoutSec 60 -UseBasicParsing
$html = $response.Content

# Bandcamp stores the whole release blob (including trackinfo) in data-tralbum.
$startTag = 'data-tralbum="'
$start = $html.IndexOf($startTag)
if ($start -lt 0) { throw 'data-tralbum attribute not found - Bandcamp markup changed.' }
$start = $start + $startTag.Length
$end = $html.IndexOf('"', $start)
if ($end -lt 0) { throw 'data-tralbum value not terminated.' }
$raw = $html.Substring($start, $end - $start)
$json = $raw.Replace('&quot;', '"').Replace('&#39;', "'").Replace('&amp;', '&').Replace('&lt;', '<').Replace('&gt;', '>')
$release = $json | ConvertFrom-Json
$tracks = $release.trackinfo
Write-Host ("tracks: {0}" -f $tracks.Count) -ForegroundColor Cyan

# The two tracks the user already supplied as FLAC - keep those files.
$userSupplied = @{
  '3' = @{ id = 'ether'; file = 'ether.flac' }
  '5' = @{ id = 'afterlife'; file = 'afterlife.flac' }
}

function Get-Slug([string]$title, [int]$order) {
  $clean = ($title.ToLower() -replace '[^a-z0-9]+', '-').Trim('-')
  return ('{0:d2}-{1}' -f $order, $clean)
}

$manifest = New-Object System.Collections.ArrayList
$downloaded = 0
$skipped = 0

foreach ($track in ($tracks | Sort-Object track_num)) {
  $order = [int]$track.track_num
  $user = $userSupplied["$order"]
  $id = if ($user) { $user.id } else { Get-Slug $track.title $order }
  $file = if ($user) { $user.file } else { "$id.mp3" }
  $stream = $track.file.'mp3-128'

  [void]$manifest.Add([ordered]@{
    id         = $id
    title      = $track.title
    order      = $order
    duration   = [int][Math]::Round([double]$track.duration)
    file       = "/audio/music/$file"
    bandcamp   = "https://melodysheep.bandcamp.com$($track.title_link)"
    stream     = $stream
    userFile   = [bool]$user
  })

  $target = Join-Path $outDir $file
  if ($ManifestOnly) { continue }
  if (-not $Force -and (Test-Path $target)) { $skipped++; continue }
  if ($user -and (Test-Path $target)) { $skipped++; continue }
  if (-not $stream) {
    Write-Host ("--   {0}. {1}  (no stream url)" -f $order, $track.title) -ForegroundColor DarkYellow
    continue
  }
  try {
    Invoke-WebRequest -Uri $stream -Headers $headers -TimeoutSec 120 -OutFile $target -UseBasicParsing
    $size = (Get-Item $target).Length
    if ($size -lt 4096) { throw 'file too small' }
    $downloaded++
    Write-Host ("OK   {0}  {1:N1} MB" -f $file, ($size / 1MB)) -ForegroundColor Green
  } catch {
    Write-Host ("--   {0}  {1}" -f $file, $_.Exception.Message) -ForegroundColor Red
  }
}

$payload = [ordered]@{
  album   = $albumTitle
  artist  = 'melodysheep'
  year    = 2019
  license = 'Attribution Non Commercial Share Alike'
  source  = $albumUrl
  tracks  = $manifest
}
$outFile = Join-Path $outDir 'album.json'
[IO.File]::WriteAllText($outFile, ($payload | ConvertTo-Json -Depth 6), (New-Object System.Text.UTF8Encoding($false)))

Write-Host ("`ndownloaded {0}, skipped {1}, tracks {2} -> public/audio/music/" -f $downloaded, $skipped, $manifest.Count) -ForegroundColor Cyan
