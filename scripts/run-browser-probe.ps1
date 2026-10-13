param(
  [ValidateSet('browse', 'search')]
  [string]$Mode = 'browse',
  [switch]$Visible,
  [switch]$Install,
  [string]$PythonPath = 'D:\python\python.exe'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$agentRoot = Join-Path $projectRoot 'browser-agent'
$agentPython = Join-Path $agentRoot '.venv\Scripts\python.exe'
$runtimeRoot = Join-Path $projectRoot 'output\browser-agent'
$env:PIP_CACHE_DIR = Join-Path $projectRoot 'output\pip-cache'
$env:TEMP = Join-Path $runtimeRoot 'temp'
$env:TMP = $env:TEMP
$env:PYTHONUTF8 = '1'
New-Item -ItemType Directory -Path $env:PIP_CACHE_DIR, $env:TEMP -Force | Out-Null

if ($Install) {
  if (-not (Test-Path -LiteralPath $agentPython)) {
    if (-not (Test-Path -LiteralPath $PythonPath)) {
      throw 'Python was not found. Supply -PythonPath with your D drive Python executable.'
    }
    & $PythonPath -m venv (Join-Path $agentRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Creating the Python environment failed.' }
  }
  $requirements = Join-Path $agentRoot 'requirements.lock'
  if (-not (Test-Path -LiteralPath $requirements)) {
    $requirements = Join-Path $agentRoot 'requirements.txt'
  }
  & $agentPython -m pip install -r $requirements
  if ($LASTEXITCODE -ne 0) { throw 'Installing Browser Use failed.' }
}

if (-not (Test-Path -LiteralPath $agentPython)) {
  throw 'The Browser Use environment is missing. Run this script with -Install first.'
}
$probeArguments = @((Join-Path $agentRoot 'probe.py'), '--mode', $Mode)
if ($Visible) { $probeArguments += '--visible' }
& $agentPython @probeArguments
if ($LASTEXITCODE -ne 0) { throw 'Browser Use probe failed. See its result.json and terminal output.' }
