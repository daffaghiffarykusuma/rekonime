Param(
  [string]$InputPath = "data/anime.full.json",
  [string]$OutputPath = "js/data.js"
)

Set-StrictMode -Version Latest
$ErrorActionPreference = "Stop"

$scriptPath = Join-Path $PSScriptRoot "regenerate-data.js"
if (!(Test-Path -Path $scriptPath)) {
  throw "Node regenerate script not found at $scriptPath"
}

node $scriptPath --input $InputPath --output $OutputPath
