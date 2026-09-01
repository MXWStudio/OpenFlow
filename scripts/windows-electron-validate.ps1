[CmdletBinding()]
param(
  [Parameter(Mandatory = $true)][ValidateSet('Dev', 'Candidate')][string]$Mode,
  [Parameter(Mandatory = $true)][string]$RepoRoot,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{40}$')][string]$SourceCommit,
  [Parameter(Mandatory = $true)][ValidatePattern('^[a-fA-F0-9]{64}$')][string]$SnapshotSha256,
  [Parameter(Mandatory = $true)][ValidateSet('true', 'false')][string]$SourceDirtyText,
  [Parameter(Mandatory = $true)][string]$EvidenceRoot
)

$ErrorActionPreference = 'Stop'
$repo = (Resolve-Path -LiteralPath $RepoRoot).Path
$SourceDirty = $SourceDirtyText -eq 'true'
$system32 = Join-Path $env:SystemRoot 'System32'
$env:PATH = "$system32;$env:PATH"
New-Item -ItemType Directory -Path $EvidenceRoot -Force | Out-Null

function Invoke-Gate([string]$name, [scriptblock]$action) {
  Write-Output "OPENFLOW_GATE_START=$name"
  & $action
  if ($LASTEXITCODE -ne 0) { throw "$name failed with exit code $LASTEXITCODE." }
  Write-Output "OPENFLOW_GATE_PASS=$name"
}

function Get-LastJson([object[]]$output, [string]$label) {
  $line = @($output | ForEach-Object { [string]$_ } | Where-Object { $_.Trim().StartsWith('{') }) | Select-Object -Last 1
  if (-not $line) { throw "$label did not return a JSON result." }
  return $line | ConvertFrom-Json
}

function Invoke-PowerShellScript([string]$path, [object[]]$arguments) {
  $previousPreference = $ErrorActionPreference
  try {
    # Windows PowerShell 5.1 promotes a child process' stderr to NativeCommandError
    # under Stop. Preserve the diagnostic stream and judge the script by its exit code.
    $ErrorActionPreference = 'Continue'
    $output = & powershell -NoProfile -NonInteractive -ExecutionPolicy Bypass -File $path @arguments 2>&1
    $exitCode = $LASTEXITCODE
  }
  finally {
    $ErrorActionPreference = $previousPreference
  }
  [pscustomobject]@{ Output = @($output); ExitCode = $exitCode }
}

$stableInstall = 'C:\Users\EDY\Downloads\openflow-studio'
$stableConfig = Join-Path $env:APPDATA 'openflow-studio\openflow-config.json'
$stableBefore = [ordered]@{
  InstallExists = Test-Path -LiteralPath $stableInstall
  ConfigExists = Test-Path -LiteralPath $stableConfig -PathType Leaf
  ConfigSha256 = if (Test-Path -LiteralPath $stableConfig -PathType Leaf) { (Get-FileHash -LiteralPath $stableConfig -Algorithm SHA256).Hash } else { '' }
}

Push-Location $repo
try {
  Invoke-Gate 'DEPENDENCY_INSTALL' { & npm ci }
  Invoke-Gate 'TYPECHECK' { & npm run typecheck }
  Invoke-Gate 'LINT' { & npm run lint }
  Invoke-Gate 'UNIT_TESTS' { & npm test }
  Invoke-Gate 'ELECTRON_E2E' { & npm run test:e2e }
  Invoke-Gate 'PRODUCTION_BUILD' { & npm run build:app }
  Write-Output 'OPENFLOW_WINDOWS_TESTS=PASS'

  if ($Mode -eq 'Dev') {
    $buildInvocation = Invoke-PowerShellScript 'scripts/build-windows-channel.ps1' @(
      '-Channel', 'Dev', '-SourceCommit', $SourceCommit, '-SnapshotSha256', $SnapshotSha256,
      '-SourceDirtyText', $SourceDirtyText
    )
    $buildOutput = $buildInvocation.Output
    $buildOutput | ForEach-Object { Write-Output $_ }
    if ($buildInvocation.ExitCode -ne 0) { throw 'Dev package build failed.' }
    $build = Get-LastJson $buildOutput 'Dev build'
    $devBatch = 'DEV ' + [char]0x00B7 + ' ' + (Get-Date).ToString('MM-dd HH:mm:ss')
    $devMarker = [ordered]@{
      schemaVersion = 1
      label = $devBatch
      synchronizedAt = [DateTime]::UtcNow.ToString('o')
      sourceCommit = $SourceCommit.ToLowerInvariant()
      sourceSnapshotSha256 = $SnapshotSha256.ToLowerInvariant()
    }
    $devMarkerPath = Join-Path ([string]$build.PackageRoot) 'resources\dev-sync.json'
    $devMarker | ConvertTo-Json | Set-Content -LiteralPath $devMarkerPath -Encoding UTF8
    $env:OPENFLOW_E2E_EXECUTABLE_PATH = Join-Path ([string]$build.PackageRoot) 'OpenFlow Studio Dev.exe'
    $env:OPENFLOW_E2E_EXPECT_CHANNEL = 'dev'
    $env:OPENFLOW_E2E_EXPECT_DEV_BATCH = $devBatch
    $env:OPENFLOW_E2E_WRITE_MARKER = 'dev-' + $SnapshotSha256.Substring(0, 12)
    try {
      Invoke-Gate 'STAGED_DEV_E2E' { & npm run test:e2e:packaged }
    }
    finally {
      Remove-Item Env:OPENFLOW_E2E_EXECUTABLE_PATH -ErrorAction SilentlyContinue
      Remove-Item Env:OPENFLOW_E2E_EXPECT_CHANNEL -ErrorAction SilentlyContinue
      Remove-Item Env:OPENFLOW_E2E_EXPECT_DEV_BATCH -ErrorAction SilentlyContinue
      Remove-Item Env:OPENFLOW_E2E_WRITE_MARKER -ErrorAction SilentlyContinue
    }
    $installInvocation = Invoke-PowerShellScript 'scripts/install-dev-atomic.ps1' @(
      '-PackageRoot', ([string]$build.PackageRoot), '-TargetRoot', 'D:\OpenFlow\Dev',
      '-SourceCommit', $SourceCommit, '-SnapshotSha256', $SnapshotSha256
    )
    $installOutput = $installInvocation.Output
    $installOutput | ForEach-Object { Write-Output $_ }
    if ($installInvocation.ExitCode -ne 0) { throw 'Dev atomic installation failed.' }
    $install = Get-LastJson $installOutput 'Dev install'
    $result = [ordered]@{
      Status = 'PASS'
      Mode = 'Dev'
      SourceCommit = $SourceCommit.ToLowerInvariant()
      SnapshotSha256 = $SnapshotSha256.ToLowerInvariant()
      SourceDirty = $SourceDirty
      WindowsTests = 'PASS'
      DevBuild = 'PASS'
      DevInstall = 'PASS'
      DevTarget = [string]$install.Target
      DevBatch = [string]$install.Batch
      DevAppId = 'com.openflow.studio.dev'
      DevVersion = [string](Get-Content -Raw package.json | ConvertFrom-Json).version
      StableTouched = 'NO'
    }
  }
  else {
    $baselineVersion = '2.5.2'
    $baselineInvocation = Invoke-PowerShellScript 'scripts/build-windows-channel.ps1' @(
      '-Channel', 'Candidate', '-SourceCommit', $SourceCommit, '-SnapshotSha256', $SnapshotSha256,
      '-SourceDirtyText', $SourceDirtyText, '-VersionOverride', $baselineVersion
    )
    $baselineOutput = $baselineInvocation.Output
    $baselineOutput | ForEach-Object { Write-Output $_ }
    if ($baselineInvocation.ExitCode -ne 0) { throw 'Candidate baseline package build failed.' }
    $baselineBuild = Get-LastJson $baselineOutput 'Candidate baseline build'
    $baselineCopy = Join-Path $EvidenceRoot 'OpenFlow-Studio-Candidate-Baseline-2.5.2.exe'
    Copy-Item -LiteralPath ([string]$baselineBuild.Installer) -Destination $baselineCopy -Force

    $currentInvocation = Invoke-PowerShellScript 'scripts/build-windows-channel.ps1' @(
      '-Channel', 'Candidate', '-SourceCommit', $SourceCommit, '-SnapshotSha256', $SnapshotSha256,
      '-SourceDirtyText', $SourceDirtyText
    )
    $currentOutput = $currentInvocation.Output
    $currentOutput | ForEach-Object { Write-Output $_ }
    if ($currentInvocation.ExitCode -ne 0) { throw 'Candidate current package build failed.' }
    $currentBuild = Get-LastJson $currentOutput 'Candidate current build'
    $currentCopy = Join-Path $EvidenceRoot ([System.IO.Path]::GetFileName([string]$currentBuild.Installer))
    Copy-Item -LiteralPath ([string]$currentBuild.Installer) -Destination $currentCopy -Force

    $acceptanceInvocation = Invoke-PowerShellScript 'scripts/verify-windows-candidate.ps1' @(
      '-RepoRoot', $repo, '-CurrentInstaller', $currentCopy, '-BaselineInstaller', $baselineCopy,
      '-TargetRoot', 'D:\OpenFlow\Candidate', '-SourceCommit', $SourceCommit,
      '-SnapshotSha256', $SnapshotSha256, '-EvidenceRoot', $EvidenceRoot
    )
    $acceptanceOutput = $acceptanceInvocation.Output
    $acceptanceOutput | ForEach-Object { Write-Output $_ }
    if ($acceptanceInvocation.ExitCode -ne 0) { throw 'Candidate installation acceptance failed.' }
    $acceptance = Get-LastJson $acceptanceOutput 'Candidate acceptance'
    $result = [ordered]@{
      Status = 'PASS'
      Mode = 'Candidate'
      SourceCommit = $SourceCommit.ToLowerInvariant()
      SnapshotSha256 = $SnapshotSha256.ToLowerInvariant()
      SourceDirty = $SourceDirty
      WindowsTests = 'PASS'
      CandidateBuild = 'PASS'
      CandidateAcceptance = 'PASS'
      CandidateTarget = [string]$acceptance.InstallDirectory
      CandidateInstaller = [string]$acceptance.Installer
      CandidateInstallerSha256 = [string]$acceptance.InstallerSha256
      CandidateAppId = [string]$acceptance.AppId
      CandidateVersion = [string]$acceptance.Version
      CandidateBuildTime = [string]$acceptance.BuildTime
      Authenticode = [string]$acceptance.Authenticode
      StableTouched = 'NO'
      Meaning = 'RELEASABLE_CANDIDATE_NOT_RELEASED'
    }
  }

  $stableAfter = [ordered]@{
    InstallExists = Test-Path -LiteralPath $stableInstall
    ConfigExists = Test-Path -LiteralPath $stableConfig -PathType Leaf
    ConfigSha256 = if (Test-Path -LiteralPath $stableConfig -PathType Leaf) { (Get-FileHash -LiteralPath $stableConfig -Algorithm SHA256).Hash } else { '' }
  }
  if (($stableBefore | ConvertTo-Json -Compress) -ne ($stableAfter | ConvertTo-Json -Compress)) {
    throw 'Stable protected fingerprint changed.'
  }
  $resultPath = Join-Path $EvidenceRoot ("$($Mode.ToLowerInvariant())-result.json")
  $result | ConvertTo-Json -Depth 4 | Set-Content -LiteralPath $resultPath -Encoding UTF8
  $result['ResultPath'] = $resultPath
  $result['ResultSha256'] = (Get-FileHash -LiteralPath $resultPath -Algorithm SHA256).Hash
  $result | ConvertTo-Json -Compress
}
finally {
  Pop-Location
}
