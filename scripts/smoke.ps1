Param(
  [Parameter(Mandatory=$false)][string]$BaseUrl
)
$ErrorActionPreference = 'Stop'

# Resolve base URL: param -> .env -> default
function Get-EnvFromFile([string]$path,[string]$key){
  if (-not (Test-Path -LiteralPath $path)) { return $null }
  $line = Select-String -LiteralPath $path -Pattern ("^{0}=" -f [regex]::Escape($key)) -ErrorAction SilentlyContinue | Select-Object -First 1
  if ($null -eq $line) { return $null }
  $kv = $line.Line -split '=',2
  if ($kv.Count -lt 2) { return $null }
  return $kv[1].Trim().Trim('"')
}

$repoRoot = Split-Path -Parent $PSScriptRoot
$dotenv = Join-Path $repoRoot '.env'
if (-not $BaseUrl -or $BaseUrl.Trim() -eq '') {
  $envUrl = Get-EnvFromFile $dotenv 'VITE_API_URL'
  $BaseUrl = if ($envUrl) { $envUrl } else { 'http://localhost:5001/api/v1' }
}

# Read seeded credentials from .env (no printing)
$SEED_INSTRUCTOR_EMAIL    = Get-EnvFromFile $dotenv 'SEED_INSTRUCTOR_EMAIL'
$SEED_INSTRUCTOR_PASSWORD = Get-EnvFromFile $dotenv 'SEED_INSTRUCTOR_PASSWORD'
$SEED_PLAYER_EMAIL        = Get-EnvFromFile $dotenv 'SEED_PLAYER_EMAIL'
$SEED_PLAYER_PASSWORD     = Get-EnvFromFile $dotenv 'SEED_PLAYER_PASSWORD'

if (-not $SEED_INSTRUCTOR_EMAIL -or -not $SEED_INSTRUCTOR_PASSWORD -or -not $SEED_PLAYER_EMAIL -or -not $SEED_PLAYER_PASSWORD) {
  Write-Error 'Seed credentials missing in .env. Please ensure SEED_* variables are set.'
  exit 1
}

function Login([string]$email,[string]$password){
  $body = @{ email=$email; password=$password } | ConvertTo-Json
  Invoke-RestMethod -Uri ("{0}/auth/login" -f $BaseUrl) -Method Post -ContentType 'application/json' -Body $body
}
function GetWithToken([string]$path,[string]$token){
  $headers = @{ Authorization = ("Bearer {0}" -f $token) }
  Invoke-RestMethod -Uri ("{0}/{1}" -f $BaseUrl,$path) -Method Get -Headers $headers
}

Write-Host ("Base URL: {0}" -f $BaseUrl)

try {
  # Instructor: login + list players
  Write-Host "Step 1: Instructor login..."
  $in = Login $SEED_INSTRUCTOR_EMAIL $SEED_INSTRUCTOR_PASSWORD
  $inToken = $in.data.token
  Write-Host ("Instructor login: status={0}, role={1}" -f $in.status, $in.data.user.role)
  Write-Host "Step 1b: List players..."
  $players = GetWithToken 'progress/players' $inToken
  Write-Host ("Players endpoint: status={0}, count={1}" -f $players.status, $players.count)

  # Player: login + my progress
  Write-Host "Step 2: Player login..."
  $pl = Login $SEED_PLAYER_EMAIL $SEED_PLAYER_PASSWORD
  $plToken = $pl.data.token
  Write-Host ("Player login: status={0}, role={1}" -f $pl.status, $pl.data.user.role)
  Write-Host "Step 2b: My progress..."
  $my = GetWithToken 'progress/me' $plToken
  Write-Host ("My progress endpoint: status={0}, count={1}" -f $my.status, $my.count)

  exit 0
}
catch {
  Write-Error ("Smoke test failed: {0}" -f $_.Exception.Message)
  exit 1
}
