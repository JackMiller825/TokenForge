# Starts the TokenForge dashboard and API as one local server.
# Close this window to stop both. Double-click start-tokenforge.cmd to run it.
param(
  [switch]$Rebuild
)

$ErrorActionPreference = 'Stop'
Set-Location $PSScriptRoot

function Fail([string]$Message) {
  Write-Host ""
  Write-Host $Message -ForegroundColor Red
  Write-Host "Press Enter to close."
  [void](Read-Host)
  exit 1
}

function Test-PortFree([int]$Port) {
  $listener = $null
  try {
    $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
    $listener.Start()
    return $true
  } catch {
    return $false
  } finally {
    if ($listener) { $listener.Stop() }
  }
}

if (-not (Get-Command node -ErrorAction SilentlyContinue)) {
  Fail "Node.js 20.9 or newer is required. Install it from https://nodejs.org and run this again."
}

$nodeVersion = (& node -p "process.versions.node").Trim()
$nodeParts = $nodeVersion.Split('.')
$nodeMajor = [int]$nodeParts[0]
$nodeMinor = [int]$nodeParts[1]
if ($nodeMajor -lt 20 -or ($nodeMajor -eq 20 -and $nodeMinor -lt 9)) {
  Fail "Node.js $nodeVersion is installed. TokenForge needs 20.9 or newer."
}

# This launcher serves the dashboard and the API together. A GitHub Pages build would hide the API.
Remove-Item Env:STATIC_EXPORT -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_STATIC_EXPORT -ErrorAction SilentlyContinue
Remove-Item Env:NEXT_PUBLIC_BASE_PATH -ErrorAction SilentlyContinue

if (-not (Test-Path "node_modules")) {
  Write-Host "Installing dependencies..."
  & npm install
  if ($LASTEXITCODE -ne 0) { Fail "npm install failed." }
}

Write-Host "Checking Chromium for scanning and analysis..."
& npx playwright install chromium
if ($LASTEXITCODE -ne 0) { Fail "Playwright Chromium install failed." }

$buildMarker = Join-Path $PSScriptRoot ".next\server\app\api\health\route.js"
$needsBuild = $Rebuild -or -not (Test-Path $buildMarker)
if (-not $needsBuild) {
  $builtAt = (Get-Item $buildMarker).LastWriteTime
  $watch = @("src", "public", "scripts", "package.json", "package-lock.json", "next.config.ts", "tsconfig.json", "postcss.config.mjs")
  $newer = Get-ChildItem -Path $watch -Recurse -File -ErrorAction SilentlyContinue |
    Where-Object { $_.FullName -notmatch '\\node_modules\\|\\\.next\\' -and $_.LastWriteTime -gt $builtAt } |
    Select-Object -First 1
  if ($newer) { $needsBuild = $true }
}

if ($needsBuild) {
  Write-Host "Building the dashboard and API..."
  & npm run build
  if ($LASTEXITCODE -ne 0) { Fail "The production build failed." }
}

$port = 3000
while ($port -le 3010 -and -not (Test-PortFree $port)) { $port++ }
if ($port -gt 3010) { Fail "Ports 3000 through 3010 are already in use. Close the other TokenForge window and run this again." }

$url = "http://127.0.0.1:$port"
Write-Host ""
Write-Host "TokenForge is starting at $url" -ForegroundColor Green
Write-Host "This window is the dashboard and the scan server. Close it to stop both."
Write-Host ""

$opener = [powershell]::Create().AddScript({
  param($Target)
  for ($attempt = 0; $attempt -lt 90; $attempt++) {
    try {
      $response = Invoke-WebRequest -UseBasicParsing "$Target/api/health" -TimeoutSec 2
      if ($response.StatusCode -eq 200) {
        Start-Process $Target
        return
      }
    } catch {
      Start-Sleep -Seconds 1
    }
  }
}).AddArgument($url)
[void]$opener.BeginInvoke()

& npx next start -H 127.0.0.1 -p $port
if ($LASTEXITCODE -ne 0) { Fail "The server stopped with an error." }
