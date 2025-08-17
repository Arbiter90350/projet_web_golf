# Déploiement MongoDB (Docker) et Migration — Fairway Progress Hub

Ce guide documente l’installation sécurisée de MongoDB sur le VPS via Docker, la création d’utilisateurs (admin + app) et la migration des données depuis votre environnement local.

Important sécurité
- Ne jamais exposer 27017 publiquement. L’accès doit être limité à la machine (127.0.0.1) ou au réseau Docker interne.
- Ne commitez jamais d’identifiants dans le dépôt. Utilisez des variables d’environnement sur le VPS.
- Utilisateur applicatif à privilèges minimaux (readWrite sur la base applicative), distinct de l’administrateur.

## 1) Prérequis sur le VPS

Installer Docker et le plugin Docker Compose (méthode Ubuntu simple). À exécuter en SSH sur le VPS:
```bash
sudo apt update && sudo apt -y install docker.io docker-compose-plugin
sudo systemctl enable --now docker
sudo usermod -aG docker jmp0
# reconnectez-vous pour prendre en compte le groupe docker
```

## 2) Arborescence et fichiers de configuration (sur le VPS)

On place MongoDB sous `/srv/mongo`.
```bash
sudo mkdir -p /srv/mongo/init /srv/mongo/data
sudo chown -R jmp0:jmp0 /srv/mongo
```

Créer le fichier `/srv/mongo/.env` (sur le VPS, contenu à adapter — ne pas commiter):
```bash
# /srv/mongo/.env
MONGO_INITDB_ROOT_USERNAME=__ADMIN_USER__
MONGO_INITDB_ROOT_PASSWORD=__ADMIN_PASS__
APP_DB=fph_prod
APP_USER=__APP_USER__
APP_PASSWORD=__APP_PASS__
```

Créer le script d’initialisation pour l’utilisateur applicatif `/srv/mongo/init/01-create-app-user.js`:
```javascript
// Crée l’utilisateur applicatif avec droits minimaux
const appDb = process.env.APP_DB || 'fph_prod';
const appUser = process.env.APP_USER;
const appPass = process.env.APP_PASSWORD;

if (!appUser || !appPass) {
  print('APP_USER/APP_PASSWORD manquants — script ignoré.');
} else {
  db = db.getSiblingDB(appDb);
  db.createUser({
    user: appUser,
    pwd: appPass,
    roles: [ { role: 'readWrite', db: appDb } ]
  });
  print(`Utilisateur applicatif créé pour DB ${appDb}`);
}
```

Créer le `docker-compose.yml` `/srv/mongo/docker-compose.yml`:
```yaml
services:
  mongo:
    image: mongo:7
    container_name: mongo
    restart: unless-stopped
    env_file: .env
    ports:
      - "127.0.0.1:27017:27017"   # bind local uniquement (pas d'exposition publique)
    volumes:
      - ./data:/data/db
      - ./init:/docker-entrypoint-initdb.d:ro
    healthcheck:
      test: ["CMD", "mongosh", "--quiet", "--eval", "db.adminCommand('ping')"]
      interval: 10s
      timeout: 5s
      retries: 5
```

Démarrer MongoDB:
```bash
cd /srv/mongo && docker compose up -d
# Vérifier l’état
docker ps --filter name=mongo
```

## 3) Tests de connectivité (sur le VPS)

Tester avec l’admin:
```bash
mongosh "mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@127.0.0.1:27017/?authSource=admin" --eval "db.runCommand({ connectionStatus: 1 })"
```

Tester avec l’utilisateur applicatif:
```bash
mongosh "mongodb://${APP_USER}:${APP_PASSWORD}@127.0.0.1:27017/${APP_DB}?authSource=${APP_DB}" --eval "db.stats()"
```

## 4) Migration de la base locale vers le VPS

Objectif: exporter votre base locale et la restaurer sur le VPS. Exemple avec une base locale `fph_local` vers `fph_prod` sur le VPS.

### 4.1 Export local (poste de travail)

Sur Windows PowerShell (adaptez le nom de base et l’URI locale si nécessaire):
```powershell
$DB = "fph_local"   # nom de votre base locale
$TS = Get-Date -Format yyyyMMdd_HHmm
$ARCHIVE = "$env:USERPROFILE\Downloads\${DB}_$TS.archive.gz"

# Exporte depuis votre Mongo local (ajustez l’URI si différent)
mongodump --db $DB --archive="$ARCHIVE" --gzip --uri "mongodb://127.0.0.1:27017"

# Transfert vers le VPS (utilise votre clé ed25519)
scp -o IdentitiesOnly=yes -i "$env:USERPROFILE\.ssh\id_ed25519" "$ARCHIVE" jmp0@51.68.84.211:/tmp/
```

### 4.2 Restauration sur le VPS

Sur le VPS, restaurez avec le compte admin (droits nécessaires à la restauration). Les secrets proviennent de `/srv/mongo/.env`.
```bash
# Exemple: restaurer dans fph_prod à partir de l’archive transférée
ARCHIVE=/tmp/fph_local_YYYYMMDD_HHMM.archive.gz   # remplacez par votre fichier

mongorestore \
  --archive="$ARCHIVE" \
  --gzip \
  --nsFrom="fph_local.*" \
  --nsTo="${APP_DB}.*" \
  --uri "mongodb://${MONGO_INITDB_ROOT_USERNAME}:${MONGO_INITDB_ROOT_PASSWORD}@127.0.0.1:27017/?authSource=admin"
```

Vérifier la présence des collections:
```bash
mongosh "mongodb://${APP_USER}:${APP_PASSWORD}@127.0.0.1:27017/${APP_DB}?authSource=${APP_DB}" --eval "db.getCollectionNames()"
```

## 5) Intégration backend (Mongoose)

Configurer l’URL dans l’environnement du backend (fichier `.env` côté serveur — ne pas commiter):
```
MONGO_URI=mongodb://__APP_USER__:__APP_PASS__@127.0.0.1:27017/fph_prod?authSource=fph_prod
```

Bonnes pratiques backend:
- Timeout, retry/backoff côté client (Axios pour API; Mongoose: options `serverSelectionTimeoutMS`).
- Index uniques (email), TTL (tokens), validations de schéma strictes.
- Aucun logging de données sensibles.

## 6) Sécurité réseau et service

- UFW: ne pas ouvrir 27017 (aucune règle nécessaire, accessible en local uniquement).
- Backups: planifier des `mongodump` réguliers vers un stockage chiffré (hors dépôt).
- Monitoring: healthcheck Docker, journaux (`docker logs mongo`).

## 7) Dépannage rapide

- Connexion refusée: vérifier que le conteneur est `healthy`, credentials admin/app, et que vous utilisez `127.0.0.1`.
- Droits insuffisants en restauration: utilisez l’admin root pour `mongorestore`.
- Problème de variables: vérifier `/srv/mongo/.env` et redémarrer `docker compose up -d`.
