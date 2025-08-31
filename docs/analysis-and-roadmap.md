# Fairway Progress Hub — Analyse, Blocages de Déploiement, Sécurité, et Feuille de Route MVP

Dernière mise à jour: {DATE}

Objectif: référence unique pour passer d’un dev local stable à un déploiement de production sécurisé (VPS Docker, domaine golf-rougemont.com), avec feuille de route opérationnelle vers le MVP.

Notes:
- Production: même origine via Nginx (SPA sur /, proxy /api -> backend:5000 sur réseau Docker interne).
- IP publique non committée dans les docs. Utiliser le placeholder NEW_IP et le remplacer lors de l’exécution.

---

## 1) État de l’architecture et du code

- Backend Node.js/Express (`backend/src/index.js`):
  - Sécurité: `helmet`, CORS configurable via `CORS_ORIGINS`/`FRONTEND_URL` (même origine en prod), rate limiting global via `generalLimiter`.
  - Proxy trust: `TRUST_PROXY=1` derrière Nginx pour IP client correcte (utile au rate limiting).
  - Journalisation: `morgan` -> `winston` (`backend/src/utils/logger.js`).
  - Routes API: préfixe `/api/v1` pour auth, courses, lessons, quizzes, questions, answers, contents, progress.
  - Statut: racine `/` (info API) + `/health` (état DB/serveur) — note: `/health` n’est pas sous `/api/`.
- Connexion MongoDB (`backend/src/db.js`):
  - `MONGO_URI` obligatoire. Échec bloquant avec sortie process si non atteignable.
  - Options Mongoose v8, `autoIndex` désactivé en prod.
- Auth & RBAC:
  - Middleware `protect`/`authorize` (`backend/src/middleware/authMiddleware.js`): JWT Bearer, contrôle de rôle strict (`player` | `instructor` | `admin`).
  - Contrôleur (`backend/src/controllers/authController.js`): register (email verification), login (bloque si `isEmailVerified=false`), me, logout, verify-email, resend-verification, forgot/reset password. JWT 24h.
  - Validation entrée: `express-validator` sur register/login.
- Rate limiting (`backend/src/middleware/rateLimiters.js`):
  - Global + spécifiques (auth, register, forgot, verify), paramétrables via `RL_*`.
- Modèle utilisateur (`backend/src/models/User.js`):
  - Hash `bcrypt`, tokens email/reset (SHA-256), `isEmailVerified`, `isActive`, `role`.
- Emails (`backend/src/services/emailService.js`):
  - Fournisseurs: SMTP (OVH Exchange) par défaut ou SendGrid.
  - Dev: si config incomplète, log d’aperçu; Prod: erreur si paramètres manquants (évite faux positifs de livraison).
  - Détails SMTP: enveloppe `from/to` renseignée pour éviter `EENVELOPE`.
- Seed (`backend/src/seeds/seed.js`):
  - Crée admin/instructor/player (idempotent) et 3 parcours avec leçons. Les comptes seed sont `isEmailVerified=true`.
- Frontend React/Vite:
  - Client API (`frontend/src/services/api.ts`): base `VITE_API_URL` normalisée. En prod compose: `/api/v1` (même origine). Intercepteurs: injecte JWT, gère 401/403 (logout/redirection), hook global d’erreurs.
  - Contexte auth (`frontend/src/context/AuthContext.tsx`): login/register/logout, `/auth/me` pour hydrater l’utilisateur.
  - Route guard (`frontend/src/components/ProtectedRoute.tsx`).
- Nginx (SPA + proxy TLS en prod) (`frontend/nginx/default.tls.conf` en prod; `frontend/nginx/default.conf` pour le build de base):
  - SPA: `try_files ... /index.html`, headers sécurité (CSP, HSTS, etc.).
  - Proxy `/api/` -> `http://backend:5000` (préserve l’URI). Timeouts 60s.
- Docker Compose
  - Dev (`docker-compose.yml`): expose `database:27017`, `backend:5001->5000`, `frontend:80`. `VITE_API_URL` par défaut `http://localhost:5001/api/v1`.
  - Prod override (`docker-compose.prod.yml`): supprime exposition publique DB/backend; Nginx en prod; build avec `VITE_API_URL: /api/v1`; `TRUST_PROXY=1`, `FRONTEND_URL=https://golf-rougemont.com`, `CORS_ORIGINS` inclut domaine + NEW_IP.

---

## 2) Blocages de déploiement probables (et remèdes)

- Secrets/ENV manquants
  - `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`, Email (`EMAIL_FROM`, `SMTP_*` ou `SENDGRID_API_KEY`) requis en prod.
  - Remède: compléter `.env.prod` (cf. checklist §3).
- CORS / même origine
  - En prod, même origine via Nginx. `CORS_ORIGINS` doit inclure `https://golf-rougemont.com` et `https://NEW_IP` (tant que DNS/HTTPS pas opérationnels) pour tests ponctuels.
- Proxy / chemins
  - Nginx ne proxifie que `/api/`. L’endpoint santé backend est `/health` (non `/api/health`). Pour monitoring externe, ajouter une règle Nginx dédiée ou un endpoint `/api/v1/status` côté API.
- Emails en prod
  - Si SMTP/SendGrid non configuré, les routes register/forgot échoueront en prod (emailService lève). Remède: renseigner SMTP OVH ou basculer `EMAIL_PROVIDER=sendgrid` avec clé.
- TLS/HTTPS
  - Fichier Nginx écoute 80. Production réelle doit terminer TLS (443). Deux options: proxy TLS externe (recommandé) ou activer 443 dans le conteneur avec certificats montés.
- Réseau Docker
  - DB/back ne doivent pas exposer de ports en prod (OK via override). Vérifier `backend` peut joindre `database` via nom de service Docker.

---

## 3) Checklist de configuration (.env.prod)

Backend (conteneur API):
- NODE_ENV=production
- TRUST_PROXY=1
- MONGO_URI=mongodb://MONGO_INITDB_ROOT_USERNAME:MONGO_INITDB_ROOT_PASSWORD@database:27017/fairway?authSource=admin
- JWT_SECRET=<secret fort>
- FRONTEND_URL=https://golf-rougemont.com
- CORS_ORIGINS=https://golf-rougemont.com,https://NEW_IP
- LOG_LEVEL=info
- Email (choisir un provider):
  - EMAIL_PROVIDER=smtp
  - EMAIL_FROM="Golf Rougemont <noreply@golf-rougemont.com>"
  - SMTP_HOST=ex5.mail.ovh.net
  - SMTP_PORT=587
  - SMTP_USER=info@golf-rougemont.com
  - SMTP_PASSWORD=<secret>
  - OU: EMAIL_PROVIDER=sendgrid + SENDGRID_API_KEY=<secret> + EMAIL_FROM=...
- Optionnel seed:
  - SEED_ON_START=0
  - SEED_ADMIN_EMAIL=...
  - SEED_ADMIN_PASSWORD=...
  - SEED_INSTRUCTOR_EMAIL=...
  - SEED_INSTRUCTOR_PASSWORD=...
  - SEED_PLAYER_EMAIL=...
  - SEED_PLAYER_PASSWORD=...

Mongo init (conteneur DB):
- MONGO_INITDB_ROOT_USERNAME=<admin>
- MONGO_INITDB_ROOT_PASSWORD=<secret>
- MONGO_INITDB_DATABASE=fairway

Frontend (build args):
- VITE_API_URL=/api/v1 (prod même origine)

---

## 4) Runbook de déploiement (VPS Docker, même origine)

Prérequis:
- VPS Ubuntu durci (SSH ed25519, UFW, fail2ban, MAJ auto). Voir docs dédiées.
- DNS: enregistrement A pour `golf-rougemont.com` -> NEW_IP.

Étapes:
1) Connexion SSH
```
ssh -i %USERPROFILE%\.ssh\id_ed25519 ubuntu@NEW_IP
```

2) Installer Docker & Compose (si absent) et cloner le dépôt.

3) Créer et remplir `.env.prod` à la racine du repo (voir §3). Ne pas committer.

4) Build & run (prod, même origine)
```
docker compose --env-file .env.prod -f docker-compose.yml -f docker-compose.prod.yml up -d --build
```

5) Seed (optionnel, une fois)
```
docker compose --env-file .env.prod run --rm seed
```

6) Vérifications réseau/containers
```
docker compose ps
docker compose logs -f backend
```

7) Tests rapides (depuis votre poste)
- SPA: `https://app.golf-rougemont.com/` doit renvoyer l’app (HTTP redirige vers HTTPS).
- API via proxy: `curl https://app.golf-rougemont.com/api/v1/auth/login -i` (attendu 400 si corps manquant).
- Santé backend: exposé via Nginx sur `GET https://app.golf-rougemont.com/api/health` (proxy vers `/health` du backend).

8) HTTPS/TLS
- Implémenté: TLS terminé dans le conteneur frontend Nginx (Option B). Certificats montés depuis `./secrets/tls/` vers `/etc/nginx/certs/`, port 443 exposé. HSTS activé côté Nginx.

---

## 5) Smoke tests (post-déploiement)

- Auth
  - Register: POST `/api/v1/auth/register` (email réel requis si prod SMTP/SG configuré).
  - Verify-email: GET lien reçu; Login doit fonctionner ensuite.
  - Login: POST `/api/v1/auth/login` -> token.
  - Me: GET `/api/v1/auth/me` avec Authorization Bearer -> 200 + user.
- RBAC
  - Accès endpoints protégés avec rôles différents (admin/instructor/player) -> 403 attendu si rôle insuffisant.
- Rate limiting
  - Tentatives login répétées -> 429 après seuil.
- CORS
  - Requêtes depuis `https://golf-rougemont.com` OK; autres origines bloquées.

---

## 6) Feuille de route vers MVP (priorisée)

- P0 — Remédiation technique & sécurité
  - Finaliser `.env.prod` + secrets, activer `TRUST_PROXY=1`.
  - Décider de la terminaison TLS (proxy externe vs conteneur) et l’implémenter.
  - Proxifier `/health` (Nginx) ou ajouter `/api/v1/status` côté API pour monitoring.
  - Vérifier journaux & niveaux (`LOG_LEVEL=info` en prod). Ajouter rotation si nécessaire (docker/json-file ou Loki).
- P1 — Déploiement contrôle / QA
  - Déploiement clean sur VPS (compose prod) + seed une fois.
  - Exécuter smoke tests (§5) et valider chemins critiques.
- P2 — Outils instructeur & contenus
  - Finaliser UI gestion contenus (cours/leçons), vérifications RBAC côté API et client.
  - Stockage médias: utiliser OVH Object Storage (jamais en DB).
- P3 — Parcours joueur & UX
  - Guards de routes, i18n (clés), validation formulaires (cohérence FE/BE), chargement paresseux.
- P4 — Tests & Observabilité
  - Tests unitaires auth/RBAC/rate limiting. Tests d’intégration clés. Journaux structurés (sans données sensibles). Tableaux de bord basiques.

Critères d’acceptation MVP:
- Déploiement stable en prod (HTTP/HTTPS), auth complète (register/verify/login/reset), RBAC effectif, contenus accessibles selon rôles, journalisation utile, rate limiting actif, CORS strict.

---

## 7) Améliorations recommandées (non bloquantes)

- Ajouter `/api/v1/health` (miroir) pour l’alignement avec le proxy `/api/`.
- Configurer un endpoint `GET /api/v1/version` statique pour supervision.
- Ajouter `helmet` options avancées (CSP affinée par environnement si besoin des CDN). Vérifier HSTS activé uniquement sous HTTPS.
- Implémenter rotation des logs et corrélation requête (request-id).
- Tests automatisés CI pour endpoints critiques et RBAC.

---

## 8) Références fichiers

- Backend: `backend/src/index.js`, `backend/src/db.js`, `backend/src/middleware/authMiddleware.js`, `backend/src/middleware/rateLimiters.js`, `backend/src/controllers/authController.js`, `backend/src/models/User.js`, `backend/src/services/emailService.js`, `backend/src/seeds/seed.js`
- Frontend: `frontend/src/services/api.ts`, `frontend/src/context/AuthContext.tsx`, `frontend/src/components/ProtectedRoute.tsx`
- Nginx: `frontend/nginx/default.conf`, `frontend/nginx/default.tls.conf`
- Compose: `docker-compose.yml`, `docker-compose.prod.yml`
