[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('Dev', 'Candidate')][string]$Channel,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$SourceCommit,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$SnapshotSha256,
  [Parameter(Mandatory = $true)][ValidateSet('true', 'false')][string]$SourceDirtyText,
  [string]$VersionOverride = ''
)

$ErrorActionPreference = 'Stop'
if ($env:OS -ne 'Windows_NT') { throw 'Windows channel packages must be built on Windows.' }
$repo = (Resolve-Path -LiteralPath (Join-Path $PSScriptRoot '..')).Path
$channelName = $Channel.ToLowerInvariant()
$builtAt = [DateTime]::UtcNow.ToString('o')
$sourceDirty = $SourceDirtyText -eq 'true'

Push-Location $repo
try {
  $env:OPENFLOW_BUILD_CHANNEL = $channelName
  $env:OPENFLOW_PACKAGE_VERSION_OVERRIDE = $VersionOverride
  $env:OPENFLOW_UPDATE_CHANNEL_URL = ''
  $env:OPENFLOW_UPDATE_PUBLIC_KEY = ''
  $env:OPENFLOW_SENTRY_DSN = ''
  & node scripts/prepare-build-metadata.mjs --channel $channelName --commit $SourceCommit `
    --snapshot-sha256 $SnapshotSha256 --dirty $SourceDirtyText --built-at $builtAt
  if ($LASTEXITCODE -ne 0) { throw 'Build identity generation failed.' }
  & npm run prepare:extension
  if ($LASTEXITCODE -ne 0) { throw 'Extension preparation failed.' }
  & npm run prepare:update-config
  if ($LASTEXITCODE -ne 0) { throw 'Update configuration preparation failed.' }
  & npm run build:app
  if ($LASTEXITCODE -ne 0) { throw 'Electron production build failed.' }
  $target = if ($Channel -eq 'Dev') { 'dir' } else { 'nsis' }
  & npx electron-builder --config scripts/electron-builder.channel.cjs --win $target --publish never
  if ($LASTEXITCODE -ne 0) { throw "$Channel package build failed." }

  $output = Join-Path $repo "build-dist\$channelName"
  $identityPath = Join-Path $repo '.openflow-build\build-metadata.json'
  $result = [ordered]@{
    Status = 'PASS'
    Channel = $Channel
    Output = $output
    SourceCommit = $SourceCommit.ToLowerInvariant()
    SnapshotSha256 = $SnapshotSha256.ToLowerInvariant()
    SourceDirty = $sourceDirty
    BuiltAt = $builtAt
    IdentitySha256 = (Get-FileHash -LiteralPath $identityPath -Algorithm SHA256).Hash
  }
  if ($Channel -eq 'Dev') {
    $result['PackageRoot'] = Join-Path $output 'win-unpacked'
  }
  else {
    $expectedVersion = if ($VersionOverride) { $VersionOverride } else { [string](Get-Content -Raw package.json | ConvertFrom-Json).version }
    $installerPath = Join-Path $output ("OpenFlow Studio Candidate-Setup-$expectedVersion.exe")
    if (-not (Test-Path -LiteralPath $installerPath -PathType Leaf)) { throw "Candidate $expectedVersion installer was not generated." }
    $installer = Get-Item -LiteralPath $installerPath
    $result['Installer'] = $installer.FullName
    $result['InstallerSha256'] = (Get-FileHash -LiteralPath $installer.FullName -Algorithm SHA256).Hash
    $result['Version'] = $expectedVersion
  }
  $result | ConvertTo-Json -Compress
}
finally {
  Remove-Item Env:OPENFLOW_BUILD_CHANNEL -ErrorAction SilentlyContinue
  Remove-Item Env:OPENFLOW_PACKAGE_VERSION_OVERRIDE -ErrorAction SilentlyContinue
  Pop-Location
}
