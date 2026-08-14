$ErrorActionPreference = 'Stop'

$repositoryRoot = Split-Path -Parent $PSScriptRoot
$sourceRoot = Join-Path $repositoryRoot '.openflow-build\chrome-extension'
$outputRoot = Join-Path $repositoryRoot 'build-dist'
$manifest = Get-Content -Raw -Encoding UTF8 (Join-Path $sourceRoot 'manifest.json') | ConvertFrom-Json
$archiveName = "OpenFlow-Chrome-Extension-$($manifest.version).zip"
$archivePath = Join-Path $outputRoot $archiveName

if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'extension-release.json'))) {
  throw 'Prepared Chrome extension is missing extension-release.json.'
}

New-Item -ItemType Directory -Force -Path $outputRoot | Out-Null
if (Test-Path -LiteralPath $archivePath) {
  Remove-Item -LiteralPath $archivePath -Force
}
Compress-Archive -Path (Join-Path $sourceRoot '*') -DestinationPath $archivePath -CompressionLevel Optimal
Copy-Item -LiteralPath (Join-Path $sourceRoot 'extension-release.json') -Destination (Join-Path $outputRoot 'extension-release.json') -Force

Write-Host "Packaged Chrome extension: $archiveName"
