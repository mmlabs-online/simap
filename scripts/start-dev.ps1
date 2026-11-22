#Requires -Version 5.1
# Dev only: the PowerShell entry to scripts/dev-prod.mjs, like scripts/start-dev.sh. All checks, prompts and process
# handling stay in dev-prod.mjs. This file reads no secret and passes only the caller's arguments.
#   powershell -ExecutionPolicy Bypass -File scripts\start-dev.ps1 --port 3100

$ErrorActionPreference = 'Stop'

function Get-NodeMajor {
  if (-not (Get-Command node -CommandType Application -ErrorAction SilentlyContinue)) { return $null }
  $version = (& node --version | Select-Object -First 1)
  if ($version -match '^v(\d+)\.') { return [int]$Matches[1] }
  return $null
}

function Write-StartDevError([string]$Message) {
  [Console]::Error.WriteLine("start-dev: $Message")
}

$exitCode = 1
# Push/Pop, so the caller's PowerShell session stays in its own folder.
Push-Location -LiteralPath (Split-Path -Parent $PSScriptRoot)
try {
  if ((Get-NodeMajor) -eq 22) {
    & node scripts/dev-prod.mjs @args
    $exitCode = $LASTEXITCODE
  } elseif (Get-Command fnm -CommandType Application -ErrorAction SilentlyContinue) {
    & fnm exec --using=22 -- node scripts/dev-prod.mjs @args
    $exitCode = $LASTEXITCODE
  } else {
    Write-StartDevError 'Node 22 not found (install it, or install fnm and run: fnm install 22).'
  }
} finally {
  Pop-Location
}
exit $exitCode
