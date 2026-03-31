$ErrorActionPreference = "SilentlyContinue"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$deployDir = Join-Path $root ".deploy"

foreach ($pidFile in @("server.pid", "cloudflared.pid")) {
  $pidPath = Join-Path $deployDir $pidFile

  if (-not (Test-Path $pidPath)) {
    continue
  }

  $targetPid = Get-Content $pidPath
  Stop-Process -Id $targetPid -Force
  Remove-Item -LiteralPath $pidPath -Force
}

Write-Output "Preview processes stopped."
