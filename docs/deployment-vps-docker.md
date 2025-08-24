# Déploiement VPS (Docker) — golf-rougemont.com

Ce guide décrit le déploiement en production sur un VPS Ubuntu avec Docker Compose, pour le domaine golf-rougemont.com.

Important:
- Utiliser des clés SSH ed25519 pour se connecter au VPS (utilisateur par défaut: `ubuntu`).
- Ne jamais committer d’adresses IP publiques ni de secrets. Dans la documentation, utiliser le placeholder `NEW_IP`. Au moment d’exécuter les commandes, remplacez `NEW_IP` par l’IP réelle du VPS.
- Même origine (same-origin): Nginx du frontend sert l’app et proxifie `/api/` vers le backend en réseau Docker interne. Aucune exposition publique du backend ni de MongoDB.

## Pré-requis VPS
- Ubuntu à jour (UFW activé si souhaité: HTTP/HTTPS/SSH ouverts).
- Docker + Docker Compose V2 installés.
- DNS: enregistrez un A record `golf-rougemont.com` → `NEW_IP` (et `www` si désiré).

## Fichiers de configuration utilisés
- `docker-compose.yml` (base dev) + `docker-compose.prod.yml` (override prod)
- `frontend/nginx/default.prod.conf` (Nginx prod: SPA + proxy `/api/`)
- `.env.prod.example` → copier en `.env` (ou `.env.prod`) et remplir les secrets

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
```

3) Vérifier la configuration Docker Compose

```bash
# Afficher la configuration effective (base + override prod)
docker compose -f docker-compose.yml -f docker-compose.prod.yml config
```

4) Construire et lancer en arrière-plan

```bash
# Construire les images et démarrer
sudo docker compose -f docker-compose.yml -f docker-compose.prod.yml up -d --build

# Vérifier les conteneurs
sudo docker compose ps
```

5) Vérifications post-déploiement

- Frontend: http://golf-rougemont.com (puis https après configuration TLS)
- Health backend (via proxy): `http://golf-rougemont.com/api/health` (la route backend est `GET /health` et le proxy `/api/` la relaye)
- Logs (non sensibles):

```bash
sudo docker compose logs -f backend
sudo docker compose logs -f frontend
```

## HTTPS (recommandé)

Le conteneur Nginx inclus n’embarque pas la gestion de certificats. Deux options:

- Option A (recommandée): utiliser un reverse proxy dédié (Traefik, Caddy, Nginx Proxy Manager) sur le VPS qui termine TLS en 443 et redirige vers le conteneur frontend port 80. Avantages: renouvellement automatique, séparation des préoccupations.

- Option B: gérer Let’s Encrypt dans le conteneur Nginx du frontend. Plus complexe; nécessite de monter les certificats et d’exposer 443 dans `docker-compose.prod.yml`.

Dans les deux cas, activer HSTS seulement en HTTPS effectif.

## Points de sécurité essentiels

- Secrets uniquement via variables d’environnement (`.env` côté serveur). Ne jamais committer.
- `TRUST_PROXY=1` côté backend (déjà configuré en override prod) pour récupérer l’IP client réelle et un rate limiting correct.
- `CORS_ORIGINS` strict sur `https://golf-rougemont.com` (et éventuellement `https://www.golf-rougemont.com`).
- Backend et MongoDB non exposés publiquement (pas de mapping de ports en prod).
- Journaux: pas de données sensibles, niveau `info` en prod.

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
- 502/504 Nginx: vérifier que le backend écoute sur 5000 et que le service Docker s’appelle `backend`.
- Emails: vérifier SMTP/SENDGRID et ports sortants autorisés (OVH: STARTTLS 587).
- Mongo: vérifier que le backend se connecte via `MONGO_URI` au host `database` (réseau Docker interne).
