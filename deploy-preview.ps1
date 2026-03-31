$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$deployDir = Join-Path $root ".deploy"
$cloudflaredPath = Join-Path $deployDir "cloudflared.exe"
$serverPidPath = Join-Path $deployDir "server.pid"
$tunnelPidPath = Join-Path $deployDir "cloudflared.pid"
$serverOutLog = Join-Path $deployDir "server.out.log"
$serverErrLog = Join-Path $deployDir "server.err.log"
$tunnelOutLog = Join-Path $deployDir "cloudflared.out.log"
$tunnelErrLog = Join-Path $deployDir "cloudflared.err.log"

New-Item -ItemType Directory -Force -Path $deployDir | Out-Null

if (-not (Test-Path $cloudflaredPath)) {
  Invoke-WebRequest `
    -Uri "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-windows-amd64.exe" `
    -OutFile $cloudflaredPath
}

foreach ($path in @($serverOutLog, $serverErrLog, $tunnelOutLog, $tunnelErrLog)) {
  if (Test-Path $path) {
    Remove-Item -LiteralPath $path -Force
  }
}

$server = Start-Process `
  -FilePath python `
  -ArgumentList @("-m", "http.server", "8000", "--bind", "127.0.0.1") `
  -WorkingDirectory $root `
  -RedirectStandardOutput $serverOutLog `
  -RedirectStandardError $serverErrLog `
  -PassThru
$server.Id | Out-File -Encoding ascii $serverPidPath

$tunnel = Start-Process `
  -FilePath $cloudflaredPath `
  -ArgumentList @("tunnel", "--url", "http://127.0.0.1:8000", "--no-autoupdate") `
  -WorkingDirectory $root `
  -RedirectStandardOutput $tunnelOutLog `
  -RedirectStandardError $tunnelErrLog `
  -PassThru
$tunnel.Id | Out-File -Encoding ascii $tunnelPidPath

$url = $null
for ($i = 0; $i -lt 60; $i++) {
  Start-Sleep -Seconds 2
  $match = Select-String `
    -Path $tunnelOutLog, $tunnelErrLog `
    -Pattern "https://[-a-z0-9]+\.trycloudflare\.com" `
    -AllMatches `
    -ErrorAction SilentlyContinue | Select-Object -Last 1

  if ($match) {
    $url = $match.Matches[-1].Value
    break
  }
}

if (-not $url) {
  throw "Timed out waiting for a public tunnel URL."
}

Write-Output "Live URL: $url"
