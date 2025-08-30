param(
  [string]$BranchName = $("feature/release-" + (Get-Date -Format "yyyyMMdd-HHmmss")),
  [string]$CommitMessage = "chore: release changes",
  [switch]$NoAutoMerge
)

$ErrorActionPreference = "Stop"

function Exec($cmd) {
  Write-Host "→ $cmd" -ForegroundColor Cyan
  $LastExitCode = 0
  powershell -NoProfile -Command $cmd
  if ($LASTEXITCODE -ne 0) { throw "Command failed: $cmd" }
}

# Ensure clean working tree
$gitStatus = git status --porcelain
if (-not $gitStatus) {
  Write-Host "Working tree clean. Proceeding..." -ForegroundColor Green
} else {
  Write-Host "Uncommitted changes will be included in this release." -ForegroundColor Yellow
}

# Sync main and create branch
Exec "git fetch origin --prune"
Exec "git switch main"
Exec "git pull --ff-only origin main"
Exec "git switch -c $BranchName"

# Stage/commit/push
Exec "git add -A"
try {
  Exec "git commit -m `"$CommitMessage`""
} catch {
  Write-Host "Nothing to commit; continuing..." -ForegroundColor Yellow
}
Exec "git push -u origin $BranchName"

# Create PR using GitHub CLI if available
$hasGh = (Get-Command gh -ErrorAction SilentlyContinue) -ne $null
if ($hasGh) {
  Write-Host "Creating PR to main via GitHub CLI..." -ForegroundColor Cyan
  Exec "gh pr create --base main --head $BranchName --fill"
  if (-not $NoAutoMerge) {
    Write-Host "Enabling auto-merge after CI passes..." -ForegroundColor Cyan
    Exec "gh pr merge --merge --auto"
  } else {
    Write-Host "Auto-merge disabled. Merge PR manually in GitHub UI." -ForegroundColor Yellow
  }
} else {
  Write-Host "GitHub CLI not found. Please open a PR from $BranchName to main in GitHub UI." -ForegroundColor Yellow
}

Write-Host "When PR is merged, syncing local main..." -ForegroundColor Cyan
Write-Host "Run after merge:" -ForegroundColor Gray
Write-Host "  git switch main" -ForegroundColor Gray
Write-Host "  git pull --ff-only origin main" -ForegroundColor Gray

# Optional: manual VPS deployment commands (if not using deploy-prod workflow)
$manual = @"
Manual VPS deploy (alternative to GitHub Actions):
1) SSH into VPS and navigate to app dir:
   ssh -p <VPS_SSH_PORT> <VPS_USER>@NEW_IP
   cd <VPS_APP_DIR>
   # If repo is a git clone on the VPS (manual mode):
   git pull --ff-only

2) Docker Compose (prod):
   docker compose -f docker-compose.yml -f docker-compose.prod.yml pull || true
   docker compose -f docker-compose.yml -f docker-compose.prod.yml build --pull
   docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --remove-orphans
   docker system prune -f || true
"@

Write-Host $manual -ForegroundColor DarkGray

Write-Host "Done. PR opened. CI will validate and deploy on push to main via 'deploy-prod' workflow." -ForegroundColor Green
