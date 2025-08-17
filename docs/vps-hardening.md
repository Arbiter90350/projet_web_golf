# Durcissement VPS — Fairway Progress Hub

Ce guide décrit les étapes minimales pour sécuriser un VPS Ubuntu fraîchement provisionné et préparer le déploiement de l’application.

- Accès initial:
  - SSH: `ssh ubuntu@51.68.84.211`
  - Utilisateur cible à créer: `jmp0`

ATTENTION: Testez toujours la connexion SSH avec la nouvelle identité avant de fermer la session d’origine.

## 1) Clé SSH locale (poste de travail)

- Chemin recommandé (Windows): `%USERPROFILE%\\.ssh\\id_ed25519.pub`
- Générer si nécessaire (ed25519 conseillé):
  - PowerShell: `ssh-keygen -t ed25519 -N "" -f $env:USERPROFILE\\.ssh\\id_ed25519`

Afficher la clé publique (clé existante):
```powershell
type $env:USERPROFILE\\.ssh\\id_ed25519.pub
```

Copier la clé sur le VPS (option pratique via scp):
```powershell
scp $env:USERPROFILE\\.ssh\\id_ed25519.pub ubuntu@51.68.84.211:/tmp/jmp0.pub
```

## 2) Mises à jour et paquets sécurité (sur le VPS)
```bash
sudo apt update && sudo apt -y upgrade
sudo apt -y install sudo ufw fail2ban unattended-upgrades
```

## 3) Créer l’utilisateur sudo non-root et ajouter la clé
```bash
# Crée l’utilisateur s’il n’existe pas et l’ajoute au groupe sudo
id -u jmp0 >/dev/null 2>&1 || sudo adduser --disabled-password --gecos '' jmp0
sudo usermod -aG sudo jmp0

# Dossier SSH et droits
sudo mkdir -p /home/jmp0/.ssh
sudo chown -R jmp0:jmp0 /home/jmp0/.ssh
sudo chmod 700 /home/jmp0/.ssh

# Option A — clé copiée via scp (préféré)
if [ -f /tmp/jmp0.pub ]; then
  sudo mv /tmp/jmp0.pub /home/jmp0/.ssh/authorized_keys
  sudo chown jmp0:jmp0 /home/jmp0/.ssh/authorized_keys
  sudo chmod 600 /home/jmp0/.ssh/authorized_keys
else
  # Option B — coller manuellement la clé publique
  sudo tee /home/jmp0/.ssh/authorized_keys >/dev/null << 'EOF'
COLLER_VOTRE_CLE_PUBLIQUE_ICI
EOF
  sudo chown jmp0:jmp0 /home/jmp0/.ssh/authorized_keys
  sudo chmod 600 /home/jmp0/.ssh/authorized_keys
fi
```

Tester la connexion depuis votre poste:
```powershell
# Si vous utilisez une clé spécifique, forcez son usage (recommandé):
ssh -o IdentitiesOnly=yes -i $env:USERPROFILE\\.ssh\\id_ed25519 jmp0@51.68.84.211 whoami
```

## 4) Durcir SSH (désactiver root + mots de passe)
```bash
sudo cp /etc/ssh/sshd_config /etc/ssh/sshd_config.bak
sudo sed -i -E 's/^#?PermitRootLogin.*/PermitRootLogin no/' /etc/ssh/sshd_config
sudo sed -i -E 's/^#?PasswordAuthentication.*/PasswordAuthentication no/' /etc/ssh/sshd_config
sudo sed -i -E 's/^#?PubkeyAuthentication.*/PubkeyAuthentication yes/' /etc/ssh/sshd_config
sudo systemctl reload ssh
```

## 5) Pare-feu UFW
```bash
sudo ufw --force reset
sudo ufw default deny incoming
sudo ufw default allow outgoing
sudo ufw allow 22/tcp
sudo ufw allow 80,443/tcp
yes | sudo ufw enable
sudo ufw status verbose
```

Si vous changez le port SSH, adaptez toutes les règles et tests (`22/tcp`).

## 6) Fail2ban (protection brute-force SSH)
```bash
sudo bash -lc 'cat > /etc/fail2ban/jail.local << "EOF"\n[sshd]\nenabled = true\nport    = 22\nlogpath = /var/log/auth.log\nmaxretry = 5\nbantime  = 3600\nfindtime = 600\nEOF'
sudo systemctl enable --now fail2ban
sudo fail2ban-client status sshd
```

## 7) Mises à jour automatiques
```bash
sudo systemctl enable --now unattended-upgrades
sudo dpkg-reconfigure -f noninteractive unattended-upgrades
```

## 8) Heure et NTP
```bash
sudo timedatectl set-timezone Europe/Paris
sudo timedatectl set-ntp true
```

## 9) Préparer le déploiement (optionnel)
```bash
# Docker (méthode officielle convenience script, à valider selon vos politiques)
# curl -fsSL https://get.docker.com | sh
# sudo usermod -aG docker jmp0
# newgrp docker

# Docker Compose plugin (selon dépôt/OS)
# sudo apt -y install docker-compose-plugin
```

## 10) Checklist d'avancement — posture sécurité

- [x] Accès SSH par clé Ed25519 pour `jmp0` (sudo)
- [x] UFW actif: deny (incoming) / allow (outgoing), règles 22 (limit), 80, 443
- [x] Fail2ban actif, jail `sshd` opérationnelle
- [x] SSH durci: `PasswordAuthentication no`, `PermitRootLogin no`
- [x] Mises à jour automatiques activées (unattended-upgrades)
- [x] Restriction SSH par utilisateurs: `AllowUsers jmp0 ubuntu` (ajustable)

Note: remplacez `ubuntu` par `jmp0` seul quand vous êtes prêt à décommissionner l'accès de secours.

## 11) Audit rapide — commandes de vérification

Exécuter sur le VPS (utilisateur `ubuntu` ou `jmp0` avec sudo):

```bash
# UFW
sudo ufw status verbose

# Fail2ban (service + jail sshd)
sudo systemctl is-active fail2ban && sudo fail2ban-client status sshd

# SSHD: vérifie explicitement les deux directives
sudo bash -lc 'sshd -T 2>/dev/null | sed -n -e "s/^passwordauthentication .*/&/p" -e "s/^permitrootlogin .*/&/p"'

# Permissions des clés SSH de jmp0
sudo ls -ld /home/jmp0 /home/jmp0/.ssh /home/jmp0/.ssh/authorized_keys

# Unattended upgrades
sudo systemctl is-active unattended-upgrades || true
sudo grep -E 'Unattended-Upgrade|Update-Package-Lists' /etc/apt/apt.conf.d/20auto-upgrades || echo "20auto-upgrades: missing"
```

## 12) Optionnel — Durcir le home de `jmp0` (chmod 700)

Objectif: empêcher tout autre compte (hors root) d'explorer ou de traverser le répertoire personnel de `jmp0`.

- État courant recommandé: `~jmp0/.ssh` = 700, `authorized_keys` = 600 (déjà requis par SSH)
- Renforcement supplémentaire: passer le home de `jmp0` de 750 à 700

Commande à exécuter plus tard si besoin (non exécutée par défaut):

```bash
# Appliquer
sudo chmod 700 /home/jmp0

# Vérifier
sudo ls -ld /home/jmp0
# Attendu: drwx------

# Rollback (si un service non-root devait accéder au home)
sudo chmod 750 /home/jmp0
```

Référence rapide:
- En cas de blocage SSH, vérifiez `sshd_config`, `authorized_keys`, droits 700/600, UFW, journal `/var/log/auth.log`.
