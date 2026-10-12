# Dot-source this file so the project runtime applies to the current PowerShell.
$projectRoot = Split-Path -Parent $PSScriptRoot
$runtimeRoot = Join-Path $projectRoot 'output\tools\node'
$projectNode = Join-Path $runtimeRoot 'node.exe'

if (-not (Test-Path -LiteralPath $projectNode)) {
  $installedNode = (Get-Command node.exe -ErrorAction Stop).Source
  $installedRoot = Split-Path -Parent $installedNode
  New-Item -ItemType Directory -Path $runtimeRoot -Force | Out-Null
  Copy-Item -LiteralPath $installedNode -Destination $projectNode
  foreach ($launcher in @('npm.cmd', 'npx.cmd')) {
    Copy-Item -LiteralPath (Join-Path $installedRoot $launcher) -Destination $runtimeRoot
  }
  $modulesRoot = Join-Path $runtimeRoot 'node_modules'
  New-Item -ItemType Directory -Path $modulesRoot -Force | Out-Null
  Copy-Item -LiteralPath (Join-Path $installedRoot 'node_modules\npm') -Destination $modulesRoot -Recurse
}

$env:PATH = "$runtimeRoot;$env:PATH"
$env:npm_config_cache = Join-Path $projectRoot 'output\npm-cache'
$env:npm_config_prefix = Join-Path $projectRoot 'output\npm-global'
$env:TEMP = Join-Path $projectRoot 'output\temp'
$env:TMP = $env:TEMP
foreach ($directory in @($env:npm_config_cache, $env:npm_config_prefix, $env:TEMP)) {
  New-Item -ItemType Directory -Path $directory -Force | Out-Null
}
Write-Output "Project Node: $projectNode"
