param([string]$Destination = '../optimized-delivery', [switch]$ReplaceGenerated)
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.IO.Compression
$projectRoot = (Resolve-Path '.').Path
$deliveryPath = [IO.Path]::GetFullPath((Join-Path $projectRoot $Destination))
New-Item -ItemType Directory -Path $deliveryPath -Force | Out-Null
function Write-ProjectZip([string]$Base, [string]$Name, [bool]$Source) {
  $zipPath = Join-Path $deliveryPath $Name
  if (Test-Path -LiteralPath $zipPath) { if (!$ReplaceGenerated) { throw "Already exists: $zipPath" }; if ([IO.Path]::GetDirectoryName([IO.Path]::GetFullPath($zipPath)) -ne $deliveryPath) { throw 'Invalid output path' }; Remove-Item -LiteralPath $zipPath }
  $stream = [IO.File]::Open($zipPath, [IO.FileMode]::CreateNew)
  $archive = [IO.Compression.ZipArchive]::new($stream, [IO.Compression.ZipArchiveMode]::Create)
  $excluded = @('node_modules', 'dist', 'dist-pages', '.cache', '.git', 'qa')
  function Add-ZipDirectory([string]$Folder) {
    foreach ($item in Get-ChildItem -LiteralPath $Folder -Force) {
      if ($item.PSIsContainer) { if (!$Source -or $item.Name -notin $excluded) { Add-ZipDirectory $item.FullName }; continue }
      $entryName = $item.FullName.Substring($Base.TrimEnd('\').Length + 1).Replace('\', '/')
      $entry = $archive.CreateEntry($entryName, [IO.Compression.CompressionLevel]::Optimal)
      $inputStream = [IO.File]::OpenRead($item.FullName)
      $entryStream = $entry.Open()
      try { $inputStream.CopyTo($entryStream) } finally { $inputStream.Dispose(); $entryStream.Dispose() }
    }
  }
  try { Add-ZipDirectory $Base } finally { $archive.Dispose(); $stream.Dispose() }
  $info = Get-Item -LiteralPath $zipPath
  Write-Output "$Name : $($info.Length) bytes"
}
Write-ProjectZip (Join-Path $projectRoot 'dist-pages') 'optimized-site-20261004-final.zip' $false
Write-ProjectZip $projectRoot 'optimized-source-20261004-final.zip' $true
Get-FileHash -Algorithm SHA256 -LiteralPath (Join-Path $deliveryPath 'optimized-site-20261004-final.zip'), (Join-Path $deliveryPath 'optimized-source-20261004-final.zip') | Format-List Path, Hash
