Param(
  [string]$InputPath = "data/anime.json",
  [string]$OutputPath = "js/data.js"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

if (!(Test-Path -Path $InputPath)) {
  throw "Input JSON not found at $InputPath"
}

$json = Get-Content -Path $InputPath -Raw | ConvertFrom-Json | ConvertTo-Json -Compress
$js = "const ANIME_DATA=" + $json + ";"

$outputDir = Split-Path -Parent $OutputPath
if ($outputDir -and !(Test-Path -Path $outputDir)) {
  New-Item -ItemType Directory -Path $outputDir | Out-Null
}

Set-Content -Path $OutputPath -Value $js -Encoding UTF8
Write-Host "Wrote minified data to $OutputPath"
