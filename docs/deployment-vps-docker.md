# Déploiement VPS (Docker) — app.golf-rougemont.com (Option B: TLS dans Nginx frontend)

Ce guide décrit le déploiement en pré‑production/production sur un VPS Ubuntu/Debian avec Docker Compose, pour le sous‑domaine app.golf-rougemont.com.

Important:
- Utiliser des clés SSH ed25519 pour se connecter au VPS (utilisateur par défaut: `ubuntu`).
- Ne jamais committer d’adresses IP publiques ni de secrets. Dans la documentation, utiliser le placeholder `NEW_IP`. Au moment d’exécuter les commandes, remplacez `NEW_IP` par l’IP réelle du VPS.
- Même origine (same-origin): Nginx du frontend sert l’app et proxifie `/api/` vers le backend en réseau Docker interne. Aucune exposition publique du backend ni de MongoDB.
- TLS géré DANS le conteneur frontend (Option B). Les certificats sont montés en lecture seule.

## Pré-requis VPS
- Debian 12 (ou Ubuntu) à jour (UFW activé si souhaité: HTTP/HTTPS/SSH ouverts).
- Docker + Docker Compose V2 installés.
- DNS: enregistrez un enregistrement A pour le sous‑domaine `app` pointant vers `NEW_IP` (`app.golf-rougemont.com` → `NEW_IP`).

## Fichiers de configuration utilisés
<<<<<<< HEAD
- `docker-compose.yml` (base)
- `docker-compose.prod.yml` (override prod — expose 80/443 sur le service `frontend` et monte les certificats)
- `frontend/nginx/default.tls.conf` (Nginx TLS: SPA + proxy `/api/`)
- `.env.prod.example` → copier en `.env` et remplir les secrets
=======
- `docker-compose.yml` (base dev) + `docker-compose.prod.yml` (override prod)
- `frontend/nginx/default.tls.conf` (Nginx prod avec TLS: SPA + proxy `/api/`)
- `.env.prod.example` → copier en `.env` (ou `.env.prod`) et remplir les secrets
>>>>>>> 9fea6b1 (feat: implement TLS termination in frontend Nginx container with Let's Encrypt support)

## Étapes

1) Connexion au VPS

```bash
ssh -i %USERPROFILE%/.ssh/id_ed25519 ubuntu@NEW_IP
```

2) Récupérer le dépôt et préparer l’environnement

```bash
# Cloner le dépôt (ou pull si déjà présent)
# git clone <votre_remote> fairway-progress-hub && cd fairway-progress-hub

# Copier l’exemple d’environnement prod et l’éditer
cp .env.prod.example .env
# Éditer .env et REMPLIR:
# - JWT_SECRET
# - MONGO_INITDB_ROOT_USERNAME / MONGO_INITDB_ROOT_PASSWORD
# - SMTP_* et EMAIL_FROM si emails actifs
# - (optionnel) ajuster les limites de rate limiting
<<<<<<< HEAD

# Placer les certificats TLS (Let’s Encrypt ou équivalent) sur le VPS:
# - fullchain.pem → ./secrets/tls/fullchain.pem
# - privkey.pem   → ./secrets/tls/privkey.pem
# Ces fichiers sont ignorés par git (voir .gitignore) et montés dans le conteneur Nginx.
=======
# - TLS_CERTS_DIR (voir section HTTPS)
>>>>>>> 9fea6b1 (feat: implement TLS termination in frontend Nginx container with Let's Encrypt support)
```

3) Vérifier la configuration Docker Compose

```bash
# Afficher la configuration effective (base + override prod)
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
```

4) Construire et lancer en arrière-plan

```bash
# Construire les images et démarrer (frontend expose 80 et 443)
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Vérifier les conteneurs
sudo docker compose ps
```

5) Vérifications post-déploiement

- Frontend: https://app.golf-rougemont.com
- Health backend (via proxy): `https://app.golf-rougemont.com/api/health` (la route backend est `GET /health` et le proxy `/api/` la relaye)
- Logs (non sensibles):

```bash
sudo docker compose logs -f backend
sudo docker compose logs -f frontend
```

<<<<<<< HEAD
## HTTPS

TLS est géré par le conteneur frontend Nginx (Option B):
- Les certificats sont montés depuis `./secrets/tls/` vers `/etc/nginx/certs/`.
- La configuration Nginx utilisée est `frontend/nginx/default.tls.conf`.
- HSTS est activé côté Nginx (en production uniquement).
=======
## HTTPS (terminaison TLS dans le conteneur frontend — Option B SÉLECTIONNÉE)

Le projet est configuré pour terminer TLS directement dans le conteneur Nginx du frontend. Le fichier `docker-compose.prod.yml` expose `80:80` et `443:443`, monte `frontend/nginx/default.tls.conf` dans `/etc/nginx/conf.d/default.conf`, et monte un répertoire de certificats dans `/etc/nginx/certs`.

1) Obtenir un certificat Let’s Encrypt (mode standalone ponctuel)

```bash
sudo systemctl stop nginx || true
sudo docker compose down || true
sudo certbot certonly --standalone -d app.golf-rougemont.com
# Certificats installés typiquement sous:
#   /etc/letsencrypt/live/app.golf-rougemont.com/fullchain.pem
#   /etc/letsencrypt/live/app.golf-rougemont.com/privkey.pem
```

2) Configurer le montage des certificats

Deux méthodes:

- Recommandée (zéro copie, renouvellement auto): définir `TLS_CERTS_DIR` dans `.env` pour pointer directement vers le chemin live Let’s Encrypt:

```env
TLS_CERTS_DIR=/etc/letsencrypt/live/app.golf-rougemont.com
```

- Alternative (non recommandée): copier les fichiers dans `./secrets/tls` et laisser `TLS_CERTS_DIR` par défaut. À refaire à chaque renouvellement si vous ne pointez pas sur le chemin live.

3) Relancer le stack

```bash
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build
sudo docker compose ps
sudo docker compose logs -n 50 frontend
```

Nginx doit démarrer sans erreur de type « cannot load certificate … no start line ». Le serveur doit répondre en HTTPS et proxifier correctement `GET /api/health`.
>>>>>>> 9fea6b1 (feat: implement TLS termination in frontend Nginx container with Let's Encrypt support)

## Points de sécurité essentiels

- Secrets uniquement via variables d’environnement (`.env` côté serveur). Ne jamais committer.
- `TRUST_PROXY=1` côté backend (déjà configuré en override prod) pour récupérer l’IP client réelle et un rate limiting correct.
- `CORS_ORIGINS` strict sur `https://app.golf-rougemont.com`.
- Backend et MongoDB non exposés publiquement (pas de mapping de ports en prod).
- Journaux: pas de données sensibles, niveau `info` en prod.

## Déploiement automatisé (GitHub Actions)

Le workflow `.github/workflows/deploy-prod.yml` se connecte en SSH au VPS et exécute:
- `git fetch/reset` sur `origin/main`, puis `docker compose up -d --build` avec les fichiers `docker-compose.yml` + `docker-compose.prod.yml`.
- En cas de problème avec SSH vers GitHub (host keys / changements), un fallback HTTPS peut être utilisé si vous fournissez le secret `GITHUB_TOKEN_READONLY` (token en lecture seule) dans les secrets du dépôt. Le workflow basculera temporairement l’URL `origin` vers HTTPS avec ce token pour effectuer le `fetch`.

## Commandes utiles

```bash
# Redéployer après modifications
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Arrêter
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml down

# Nettoyer images non utilisées (prudence)
sudo docker image prune -f
```

## Dépannage rapide
- Erreurs CORS: vérifier `CORS_ORIGINS` et que le frontend appelle `/api/v1` (même origine).
- Upload direct (pré‑signé) vers OVH: vérifier la configuration CORS du bucket (voir section dédiée ci‑dessous) et que `OVH_REGION`, `OVH_ENDPOINT`, `OVH_CONTAINER` sont bien définis côté backend.

---

## Configuration CORS — OVH Object Storage (obligatoire pour l'upload pré‑signé)

L'application utilise des URL pré‑signées (méthode PUT) pour téléverser les fichiers directement depuis le navigateur vers OVH Object Storage. Il est impératif de configurer une politique CORS sur le conteneur/bucket OVH pour autoriser l'origine du frontend et la méthode PUT.

1) Préparez un fichier local (non committé — `.gitignore` comporte déjà `cors-config.json`) avec le contenu suivant:

```json
{
  "CORSRules": [
    {
      "AllowedHeaders": ["*"],
      "AllowedMethods": ["GET", "HEAD", "PUT"],
      "AllowedOrigins": ["https://app.golf-rougemont.com"],
      "ExposeHeaders": ["ETag"],
      "MaxAgeSeconds": 3600
    }
  ]
}
```

2) Appliquez cette configuration CORS sur votre bucket OVH via un outil compatible S3 (ex: AWS CLI avec `--endpoint-url` OVH), en remplaçant les placeholders (ne pas committer de secrets):

```bash
# Exemple indicatif (adapter REGION/ENDPOINT/NOM_BUCKET/AWS_PROFILE)
aws s3api put-bucket-cors \
  --bucket <NOM_BUCKET> \
  --cors-configuration file://cors-config.json \
  --endpoint-url https://s3.<REGION>.io.cloud.ovh.net \
  --region <REGION>
```

Notes:
- `AllowedOrigins` doit correspondre exactement au domaine du frontend (ici `https://app.golf-rougemont.com`).
- La méthode `PUT` doit être autorisée pour l'upload pré‑signé.
- Le backend doit recevoir `OVH_REGION`, `OVH_ENDPOINT`, `OVH_ACCESS_KEY`, `OVH_SECRET_KEY`, `OVH_CONTAINER`, `OVH_BASE_URL` via l'environnement (`.env` du VPS).
- 502/504 Nginx: vérifier que le backend écoute sur 5000 et que le service Docker s’appelle `backend`.
- Emails: vérifier SMTP/SENDGRID et ports sortants autorisés (OVH: STARTTLS 587).
- Mongo: vérifier que le backend se connecte via `MONGO_URI` au host `database` (réseau Docker interne).
