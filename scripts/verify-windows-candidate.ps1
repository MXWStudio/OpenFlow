[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][string]$CurrentInstaller,
  [Parameter(Mandatory = $true)][string]$BaselineInstaller,
  [Parameter(Mandatory = $true)][string]$TargetRoot,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$SourceCommit,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$SnapshotSha256,
  [Parameter(Mandatory = $true)][string]$EvidenceRoot
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath $RepoRoot).Path
$current = (Resolve-Path -LiteralPath $CurrentInstaller).Path
$baseline = (Resolve-Path -LiteralPath $BaselineInstaller).Path
$expectedTarget = [System.IO.Path]::GetFullPath('D:\OpenFlow\Candidate').TrimEnd('\')
$target = [System.IO.Path]::GetFullPath($TargetRoot).TrimEnd('\')
if ($target -ine $expectedTarget) { throw "Refusing unsafe Candidate target: $target" }
$candidateUserData = Join-Path $env:APPDATA 'openflow-studio-candidate'
$stableInstall = 'C:\Users\EDY\Downloads\openflow-studio'
$stableUserData = Join-Path $env:APPDATA 'openflow-studio'
$stableConfig = Join-Path $stableUserData 'openflow-config.json'
$exe = Join-Path $target 'OpenFlow Studio Candidate.exe'
$uninstaller = Join-Path $target 'Uninstall OpenFlow Studio Candidate.exe'
$currentVersion = [string](Get-Content -Raw (Join-Path $repo 'package.json') | ConvertFrom-Json).version
$baselineVersion = '2.5.2'

function Get-StableFingerprint {
  [ordered]@{
    InstallExists = Test-Path -LiteralPath $stableInstall
    UserDataExists = Test-Path -LiteralPath $stableUserData
    ConfigExists = Test-Path -LiteralPath $stableConfig -PathType Leaf
    ConfigSha256 = if (Test-Path -LiteralPath $stableConfig -PathType Leaf) {
      (Get-FileHash -LiteralPath $stableConfig -Algorithm SHA256).Hash
    } else { '' }
  }
}

function Remove-CandidateInstallation {
  if (Test-Path -LiteralPath $uninstaller -PathType Leaf) {
    $process = Start-Process -FilePath $uninstaller -ArgumentList '/S' -Wait -PassThru
    if ($process.ExitCode -ne 0) { throw "Candidate uninstall failed: $($process.ExitCode)" }
  }
  elseif (Test-Path -LiteralPath $target) {
    throw 'Candidate target exists without its exact uninstaller.'
  }
  Start-Sleep -Milliseconds 500
  if (Test-Path -LiteralPath $exe -PathType Leaf) { throw 'Candidate executable remains after uninstall.' }
}

function Install-Candidate([string]$installer) {
  $process = Start-Process -FilePath $installer -ArgumentList @('/S', "/D=$target") -Wait -PassThru
  if ($process.ExitCode -ne 0) { throw "Candidate install failed: $($process.ExitCode)" }
  if (-not (Test-Path -LiteralPath $exe -PathType Leaf)) { throw 'Candidate executable was not installed.' }
}

function Invoke-PackagedAcceptance([string]$writeMarker, [string]$expectedMarker, [string]$expectedVersion) {
  $env:OPENFLOW_E2E_EXECUTABLE_PATH = $exe
  $env:OPENFLOW_E2E_EXPECT_CHANNEL = 'candidate'
  $env:OPENFLOW_E2E_WRITE_MARKER = $writeMarker
  $env:OPENFLOW_E2E_EXPECT_EXISTING_MARKER = $expectedMarker
  $env:OPENFLOW_E2E_EXPECT_VERSION = $expectedVersion
  Push-Location $repo
  try {
    & npm run test:e2e:packaged
    if ($LASTEXITCODE -ne 0) { throw "Packaged Candidate E2E failed for $writeMarker." }
  }
  finally {
    Remove-Item Env:OPENFLOW_E2E_EXECUTABLE_PATH -ErrorAction SilentlyContinue
    Remove-Item Env:OPENFLOW_E2E_EXPECT_CHANNEL -ErrorAction SilentlyContinue
    Remove-Item Env:OPENFLOW_E2E_WRITE_MARKER -ErrorAction SilentlyContinue
    Remove-Item Env:OPENFLOW_E2E_EXPECT_EXISTING_MARKER -ErrorAction SilentlyContinue
    Remove-Item Env:OPENFLOW_E2E_EXPECT_VERSION -ErrorAction SilentlyContinue
    Pop-Location
  }
}

$stableBefore = Get-StableFingerprint
New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null
Remove-CandidateInstallation
if (Test-Path -LiteralPath $candidateUserData) { Remove-Item -LiteralPath $candidateUserData -Recurse -Force }

# Fresh install of the exact current candidate.
Install-Candidate $current
Invoke-PackagedAcceptance 'fresh-current' '' $currentVersion
Remove-CandidateInstallation

# Real overwrite upgrade from an isolated prior-version candidate.
if (Test-Path -LiteralPath $candidateUserData) { Remove-Item -LiteralPath $candidateUserData -Recurse -Force }
Install-Candidate $baseline
Invoke-PackagedAcceptance 'upgrade-baseline' '' $baselineVersion
Install-Candidate $current
Invoke-PackagedAcceptance 'upgrade-current' 'upgrade-baseline' $currentVersion

$identityPath = Join-Path $target 'resources\build-metadata.json'
$updatePath = Join-Path $target 'resources\update-config.json'
$identity = Get-Content -Raw -LiteralPath $identityPath | ConvertFrom-Json
$update = Get-Content -Raw -LiteralPath $updatePath | ConvertFrom-Json
if (
  [string]$identity.channel -ne 'candidate' -or
  [string]$identity.appId -ne 'com.openflow.studio.candidate' -or
  [string]$identity.userDataDirectory -ne 'openflow-studio-candidate' -or
  [string]$identity.sourceCommit -ine $SourceCommit -or
  [string]$identity.sourceSnapshotSha256 -ine $SnapshotSha256
) { throw 'Installed Candidate identity mismatch.' }
if ([string]$update.channelUrl -or [string]$update.releasePublicKey) {
  throw 'Candidate update configuration must not connect to Stable or Dev.'
}
$signature = Get-AuthenticodeSignature -LiteralPath $exe
$exeHash = (Get-FileHash -LiteralPath $exe -Algorithm SHA256).Hash
$installedVersion = (Get-Item -LiteralPath $exe).VersionInfo.ProductVersion
$normalizedInstalledVersion = ([version]$installedVersion).ToString(3)
$normalizedCurrentVersion = ([version]$currentVersion).ToString(3)
if ($normalizedInstalledVersion -ne $normalizedCurrentVersion) { throw "Installed Candidate version mismatch: $installedVersion" }

# Prove uninstall, then restore the verified Candidate for manual acceptance.
Remove-CandidateInstallation
Install-Candidate $current
Invoke-PackagedAcceptance 'manual-ready' 'upgrade-current' $currentVersion

$stableAfter = Get-StableFingerprint
if (($stableBefore | ConvertTo-Json -Compress) -ne ($stableAfter | ConvertTo-Json -Compress)) {
  throw 'Stable install or user-data fingerprint changed during Candidate acceptance.'
}

$report = [ordered]@{
  Status = 'PASS'
  Meaning = 'RELEASABLE_CANDIDATE_NOT_RELEASED'
  SourceCommit = $SourceCommit.ToLowerInvariant()
  SnapshotSha256 = $SnapshotSha256.ToLowerInvariant()
  Version = $currentVersion
  ExecutableProductVersion = [string]$installedVersion
  AppName = [string]$identity.appName
  AppId = [string]$identity.appId
  UserDataDirectory = [string]$identity.userDataDirectory
  InstallDirectory = $target
  Executable = $exe
  ExecutableSha256 = $exeHash
  Installer = $current
  InstallerSha256 = (Get-FileHash -LiteralPath $current -Algorithm SHA256).Hash
  BuildTime = [string]$identity.builtAt
  FreshInstall = 'PASS'
  OverwriteUpgrade = 'PASS'
  ElectronLaunchAndMainFlow = 'PASS'
  LocalDataReadWrite = 'PASS'
  RestartRecovery = 'PASS'
  Uninstall = 'PASS'
  UpdateChannelIsolation = 'PASS'
  Authenticode = if ($signature.Status -eq 'Valid') { 'PASS' } elseif ($signature.Status -eq 'NotSigned') { 'NOT_CONFIGURED' } else { 'FAIL:' + $signature.Status }
  StableTouched = 'NO'
  CandidateLeftInstalledForManualAcceptance = $true
}
$reportPath = Join-Path $EvidenceRoot 'candidate-acceptance.json'
$report | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $reportPath -Encoding UTF8
$report['Report'] = $reportPath
$report['ReportSha256'] = (Get-FileHash -LiteralPath $reportPath -Algorithm SHA256).Hash
$report | ConvertTo-Json -Compress
