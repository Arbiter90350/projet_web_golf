param(
  [switch]$NoWaitChecks,
  [switch]$NoWaitMerge,
  [switch]$DryRun,
  [string]$BaseBranch = "main",
  [string]$CommitMessage
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
  if (-not $CommitMessage -or $CommitMessage.Trim().Length -eq 0) {
    $CommitMessage = "chore: release $currentBranch ($timestamp)"
  }
  Run git @("commit","-m", $CommitMessage)
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

# Wait for checks (CI) if requested (default: wait)
if (-not $NoWaitChecks) {
  Write-Host "Attente de la fin des vérifications CI..." -ForegroundColor Cyan
  try {
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
try {
  & gh pr merge $currentBranch --squash --auto
  if ($LASTEXITCODE -ne 0) {
    Write-Warning "gh pr merge a retourné un code non nul ($LASTEXITCODE). Vérifiez les exigences de la PR (reviews, checks). L'auto-merge s'activera dès que les conditions seront remplies."
  }
} catch {
  Write-Warning "Impossible d'activer l'auto-merge via gh: $_. Vous pouvez l'activer manuellement depuis l'UI GitHub."
}

# Optionnellement attendre la fusion effective puis resynchroniser main local
if (-not $NoWaitMerge) {
  Write-Host "Attente de la fusion effective de la PR (auto-merge)..." -ForegroundColor Cyan
  $maxMinutes = 30
  $deadline = (Get-Date).AddMinutes($maxMinutes)
  while ($true) {
    $out = & gh pr view $currentBranch --json state,mergeStateStatus,mergedAt 2>$null | Out-String
    if ($LASTEXITCODE -eq 0 -and $out) {
      try {
        $json = $out | ConvertFrom-Json
        if ($json.state -eq "MERGED" -or $json.mergedAt) {
          Write-Host "PR fusionnée." -ForegroundColor Green
          break
        }
        if ($json.state -eq "CLOSED") {
          throw "La PR est fermée sans fusion."
        }
      } catch {}
    }
    if ((Get-Date) -gt $deadline) {
      Write-Warning "Temps d'attente dépassé ($maxMinutes min). On continue sans vérifier davantage."
      break
    }
    Start-Sleep -Seconds 10
  }
}

# Sync local main (après fusion ou si NoWaitMerge)
Write-Host "Mise à jour de la branche locale '$BaseBranch'..." -ForegroundColor Cyan
Run git @("switch", $BaseBranch)
Run git @("pull","--ff-only","origin", $BaseBranch)

# Infos déploiement
$manual = @"
Déploiement en production: AUTOMATISÉ après merge sur '$BaseBranch' via le workflow GitHub Actions
  .github/workflows/deploy-prod.yml

Vous n'avez rien à faire pour déployer: après la fusion en main, le job CI/CD met à jour le VPS (Docker) automatiquement.

Fallback (manuel, si nécessaire uniquement):
1) SSH et pull du dépôt:
   ssh -p <VPS_SSH_PORT> debian@NEW_IP
   cd <VPS_APP_DIR>
   git fetch --all --prune
   git reset --hard origin/$BaseBranch

2) Reconstruction/relance containers:
   docker compose -f docker-compose.yml -f docker-compose.prod.yml pull || true
   docker compose -f docker-compose.yml -f docker-compose.prod.yml build --pull
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
   docker system prune -f || true
"@
Write-Host $manual -ForegroundColor DarkGray

Write-Host "Terminé: PR fusionnée en squash, branche conservée. '$BaseBranch' local synchronisé." -ForegroundColor Green
