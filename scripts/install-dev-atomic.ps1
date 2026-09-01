[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$PackageRoot,
  [Parameter(Mandatory = $true)][string]$TargetRoot,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$SourceCommit,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$SnapshotSha256
)

$ErrorActionPreference = 'Stop'
$expectedTarget = [System.IO.Path]::GetFullPath('D:\OpenFlow\Dev').TrimEnd('\')
$target = [System.IO.Path]::GetFullPath($TargetRoot).TrimEnd('\')
if ($target -ine $expectedTarget) { throw "Refusing unsafe Dev target: $target" }
$source = (Resolve-Path -LiteralPath $PackageRoot).Path
$sourceIdentityPath = Join-Path $source 'resources\build-metadata.json'
$sourceMarkerPath = Join-Path $source 'resources\dev-sync.json'
if (-not (Test-Path -LiteralPath $sourceIdentityPath -PathType Leaf)) { throw 'Dev package identity is missing.' }
if (-not (Test-Path -LiteralPath $sourceMarkerPath -PathType Leaf)) { throw 'Verified Dev batch marker is missing.' }
$identity = Get-Content -Raw -LiteralPath $sourceIdentityPath | ConvertFrom-Json
$marker = Get-Content -Raw -LiteralPath $sourceMarkerPath | ConvertFrom-Json
if (
  [string]$identity.channel -ne 'dev' -or
  [string]$identity.appId -ne 'com.openflow.studio.dev' -or
  [string]$identity.userDataDirectory -ne 'openflow-studio-dev' -or
  [string]$identity.sourceCommit -ine $SourceCommit -or
  [string]$identity.sourceSnapshotSha256 -ine $SnapshotSha256
) { throw 'Dev package identity does not match the verified source snapshot.' }
if (
  [string]$marker.label -notmatch '^DEV \u00B7 \d{2}-\d{2} \d{2}:\d{2}:\d{2}$' -or
  [string]$marker.sourceCommit -ine $SourceCommit -or
  [string]$marker.sourceSnapshotSha256 -ine $SnapshotSha256
) { throw 'Dev batch marker does not match the verified source snapshot.' }

$running = @(Get-CimInstance Win32_Process | Where-Object {
  $_.ExecutablePath -and [System.IO.Path]::GetFullPath($_.ExecutablePath).StartsWith($target + '\', [System.StringComparison]::OrdinalIgnoreCase)
})
if ($running.Count -gt 0) { throw "OpenFlow Dev is running from $target. Close it before synchronization." }

$parent = Split-Path -Parent $target
$token = [Guid]::NewGuid().ToString('N')
$staging = Join-Path $parent ('.OpenFlowDev-staging-' + $token)
$rollback = Join-Path $parent ('.OpenFlowDev-rollback-' + $token)
$activated = $false
$oldMoved = $false
try {
  New-Item -ItemType Directory -Path $staging | Out-Null
  Get-ChildItem -LiteralPath $source -Force | Copy-Item -Destination $staging -Recurse -Force

  $manifest = @(Get-ChildItem -LiteralPath $staging -File -Recurse | Sort-Object FullName | ForEach-Object {
    [ordered]@{
      path = $_.FullName.Substring($staging.Length + 1).Replace('\', '/')
      size = $_.Length
      sha256 = (Get-FileHash -LiteralPath $_.FullName -Algorithm SHA256).Hash
    }
  })
  $manifestPath = Join-Path $staging 'dev-deployment-manifest.json'
  $manifest | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $manifestPath -Encoding UTF8
  if (-not (Test-Path -LiteralPath (Join-Path $staging 'OpenFlow Studio Dev.exe') -PathType Leaf)) {
    throw 'Staged Dev executable is missing.'
  }

  if (Test-Path -LiteralPath $target) {
    Move-Item -LiteralPath $target -Destination $rollback
    $oldMoved = $true
  }
  Move-Item -LiteralPath $staging -Destination $target
  $activated = $true

  $activeMarker = Get-Content -Raw -LiteralPath (Join-Path $target 'resources\dev-sync.json') | ConvertFrom-Json
  if ([string]$activeMarker.label -ne [string]$marker.label) { throw 'Activated Dev batch marker mismatch.' }
  if ($oldMoved -and (Test-Path -LiteralPath $rollback)) {
    Remove-Item -LiteralPath $rollback -Recurse -Force
  }
  [ordered]@{
    Status = 'PASS'
    Target = $target
    Batch = [string]$marker.label
    SourceCommit = $SourceCommit.ToLowerInvariant()
    SnapshotSha256 = $SnapshotSha256.ToLowerInvariant()
    ManifestSha256 = (Get-FileHash -LiteralPath (Join-Path $target 'dev-deployment-manifest.json') -Algorithm SHA256).Hash
  } | ConvertTo-Json -Compress
}
catch {
  if ($activated -and (Test-Path -LiteralPath $target)) {
    Remove-Item -LiteralPath $target -Recurse -Force
  }
  if ($oldMoved -and (Test-Path -LiteralPath $rollback)) {
    Move-Item -LiteralPath $rollback -Destination $target
  }
  throw
}
finally {
  if (Test-Path -LiteralPath $staging) { Remove-Item -LiteralPath $staging -Recurse -Force }
}
