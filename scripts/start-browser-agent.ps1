param(
  [ValidateRange(1024, 65535)]
  [int]$Port = 8001,
  [switch]$Install,
  [string]$PythonPath = 'D:\python\python.exe'
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$agentRoot = Join-Path $projectRoot 'browser-agent'
$agentPython = Join-Path $agentRoot '.venv\Scripts\python.exe'
$env:PIP_CACHE_DIR = Join-Path $projectRoot 'output\pip-cache'
$env:TEMP = Join-Path $projectRoot 'output\browser-agent\temp'
$env:TMP = $env:TEMP
$env:PYTHONUTF8 = '1'
New-Item -ItemType Directory -Path $env:PIP_CACHE_DIR, $env:TEMP -Force | Out-Null
if ($Install) {
  if (-not (Test-Path -LiteralPath $agentPython)) {
    & $PythonPath -m venv (Join-Path $agentRoot '.venv')
    if ($LASTEXITCODE -ne 0) { throw 'Creating the Python environment failed.' }
  }
  & $agentPython -m pip install -r (Join-Path $agentRoot 'requirements.lock')
  if ($LASTEXITCODE -ne 0) { throw 'Installing Browser Agent dependencies failed.' }
}
if (-not (Test-Path -LiteralPath $agentPython)) { throw 'Run with -Install first.' }
Write-Output "Browser Agent: http://127.0.0.1:$Port (Ctrl+C to stop)"
& $agentPython -m uvicorn app:create_local_app --factory --app-dir $agentRoot --host 127.0.0.1 --port $Port --workers 1 --timeout-graceful-shutdown 30
if ($LASTEXITCODE -ne 0) { throw 'Browser Agent service stopped with an error.' }
