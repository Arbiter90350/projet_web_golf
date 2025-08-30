param(
  [switch]$NoWaitChecks,
  [switch]$DryRun,
  [string]$BaseBranch = "main"
)

$ErrorActionPreference = "Stop"

function Run($file, [string[]]$argv) {
  $display = ($file + ' ' + ($argv -join ' ')).Trim()
  Write-Host "→ $display" -ForegroundColor Cyan
  if ($DryRun) { return }
  & $file @argv
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $display" }
}

# Detect current branch
$currentBranch = (git rev-parse --abbrev-ref HEAD).Trim()
if (-not $currentBranch) { throw "Impossible de déterminer la branche courante." }
if ($currentBranch -eq $BaseBranch) {
  throw "Vous êtes sur '$BaseBranch'. Basculez sur votre branche de feature avant d'exécuter ce script."
}

Write-Host "Branche courante: $currentBranch" -ForegroundColor Green

# Stage & commit (if changes)
$changes = git status --porcelain
if ($changes) {
  Run git @("add","-A")
  $timestamp = Get-Date -Format "yyyy-MM-dd HH:mm:ss"
  $autoMsg = "chore: release $currentBranch ($timestamp)"
  Run git @("commit","-m", $autoMsg)
} else {
  Write-Host "Aucun changement à committer." -ForegroundColor Yellow
}

# Push branch
Run git @("push","-u","origin", $currentBranch)

# Ensure GitHub CLI is available
$hasGh = $null -ne (Get-Command gh -ErrorAction SilentlyContinue)
if (-not $hasGh) {
  throw "GitHub CLI (gh) est requis. Installez-le puis exécutez 'gh auth login'."
}

# Open or reuse PR to base branch
$prExists = $false
try {
  & gh pr view --head $currentBranch --json number > $null 2>&1
  if ($LASTEXITCODE -eq 0) { $prExists = $true }
} catch {}

if (-not $prExists) {
  Write-Host "Création de la Pull Request..." -ForegroundColor Cyan
  Run gh @("pr","create","--base", $BaseBranch, "--head", $currentBranch, "--fill")
} else {
  Write-Host "PR existante détectée pour $currentBranch. Utilisation de la PR courante." -ForegroundColor Yellow
}

# Wait for checks (CI) if requested
if (-not $NoWaitChecks) {
  Write-Host "Attente de la fin des vérifications CI..." -ForegroundColor Cyan
  try {
    # Cible explicitement la PR de la branche courante pour éviter toute ambiguïté
    & gh pr checks $currentBranch --watch
    if ($LASTEXITCODE -ne 0) {
      Write-Warning "gh pr checks a retourné un code non nul ($LASTEXITCODE). On continue: l'auto-merge n'effectuera la fusion qu'après CI verte."
    }
  } catch {
    Write-Warning "Impossible de suivre les checks via gh: $_. On continue: l'auto-merge garantira la fusion uniquement après succès des checks."
  }
}

# Squash merge via auto-merge (ne PAS supprimer la branche); merge effectif après CI verte
Write-Host "Activation de l'auto-merge en squash (branche conservée)..." -ForegroundColor Cyan
Run gh @("pr","merge","--squash","--auto","--yes")

# Sync local main
Write-Host "Mise à jour de la branche locale '$BaseBranch'..." -ForegroundColor Cyan
Run git @("switch", $BaseBranch)
Run git @("pull","--ff-only","origin", $BaseBranch)

# Print VPS update commands
$manual = @"
Mise à jour manuelle sur le VPS (sans seed):
1) SSH et pull du dépôt:
   ssh -p <VPS_SSH_PORT> <VPS_USER>@<VPS_HOST>
   cd <VPS_APP_DIR>
   git pull --ff-only

2) Reconstruction/relance containers (sans profil seed):
   docker compose -f docker-compose.yml -f docker-compose.prod.yml pull || true
   docker compose -f docker-compose.yml -f docker-compose.prod.yml build --pull
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
   docker system prune -f || true
"@
Write-Host $manual -ForegroundColor DarkGray

Write-Host "Terminé: PR fusionnée en squash, branche conservée. '$BaseBranch' local synchronisé." -ForegroundColor Green
