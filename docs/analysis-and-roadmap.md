# Fairway Progress Hub — Analyse, Blocages de Déploiement, Sécurité, et Feuille de Route MVP

Dernière mise à jour: 2025-08-19

Objectif: référence unique pour passer d’un dev local stable à un déploiement de production sécurisé (VPS Docker, domaine golf-rougemont.com), avec feuille de route opérationnelle vers le MVP.

Notes:
- Production: même origine via Nginx (SPA sur /, proxy /api -> backend:5000 sur réseau Docker interne).
- IP publique non committée dans les docs. Utiliser le placeholder NEW_IP et le remplacer lors de l’exécution.

---

## 0) Statut global — Déploiement reporté (postponed)

- Le déploiement en production est temporairement REPORTÉ.
- Cette page sert désormais de référence applicative exhaustive (fonctionnel, architecture, données, API, RBAC, sécurité, configuration, tests) pour préparer une reprise de déploiement sereine ultérieurement.

---

## A) Compréhension fonctionnelle (features, rôles, parcours)

- __Rôles__ (`role` côté backend: `player` | `instructor` | `admin`):
  - `player`: suit des cours/leçons, lit des contenus, répond aux QCM, progresse par lecture/validation pro/QCM.
  - `instructor`: crée/édite des cours/leçons/quiz/questions/réponses/contenus, valide pro la progression.
  - `admin`: supervision et droits complets (équivalent instructeur + global). Gestion avancée utilisateurs côté UI (page `AdminUsersPage`) — API d’admin utilisateur à compléter ultérieurement si nécessaire.

- **Fonctionnalités noyau**:
  - Authentification JWT avec vérification email, réinitialisation mot de passe (`backend/src/routes/auth.js`).
  - Catalogue de cours + leçons ordonnées, contenus (URL vers stockage objet, cf. règle projet), quiz par leçon.
  - Progression utilisateur par leçon: `not_started` | `in_progress` | `completed` avec score (QCM) et validation pro.
  - RBAC strict côté serveur via `protect` + `authorize` (`backend/src/middleware/authMiddleware.js`).

- **Parcours utilisateur (résumé)**:
  - Joueur: Inscription -> Vérification email -> Connexion -> Parcours des cours/leçons -> Consultation contenus -> QCM/lecture -> Marquer lu (`PATCH /api/v1/progress/lessons/:lessonId/read`) -> Progression visible (`GET /api/v1/progress/me`).
  - Instructeur: Connexion -> Gestion cours/leçons -> Ajout contenus (URL OVH Object Storage) -> Création QCM -> Validation pro (`PATCH /api/v1/progress/lessons/:lessonId/pro-validate`).
  - Admin: Accès UI d’administration des utilisateurs (`frontend/src/App.tsx`), droits API équivalents à instructeur + futur scope global.

- **Front-end (routage & guards)**: `frontend/src/App.tsx`
  - `ProtectedRoute` pour les pages authentifiées.
  - `RequireRole` pour restreindre certaines routes (`instructor`, `admin`).
  - Redirection d’accueil selon rôle (`HomeRedirect`).

---

## B) Architecture (logique & physique)

- **Logique**:
  - SPA React (Vite) -> Nginx -> API Express `/api/v1/*` -> MongoDB via Mongoose.
  - Auth par JWT Bearer dans `Authorization`.
  - CORS strict en dev/pro selon `CORS_ORIGINS`/`FRONTEND_URL`.

- **Physique (Docker Compose)**:
  - Services: `frontend` (Nginx + build Vite), `backend` (Node/Express), `database` (MongoDB).
  - Prod: ports exposés publiquement uniquement pour `frontend` (80). Backend et DB restent internes au réseau Docker (`docker-compose.prod.yml`).
  - Proxy Nginx: `/api/` -> `http://backend:5000` avec timeouts, buffers adaptés (`frontend/nginx/default.prod.conf`).

- **Flux runtime**:
  - Login: `POST /api/v1/auth/login` -> token stocké client (localStorage) -> intercepteur Axios ajoute `Authorization` (`frontend/src/services/api.ts`).
  - Appels protégés: middleware `protect` vérifie JWT -> `authorize` vérifie rôle.

---

## C) Modèle de données (Mongoose)

- **User** (`backend/src/models/User.js`): email (unique), password (hash bcrypt, `select:false`), firstName, lastName, role, isActive, isEmailVerified, tokens/expirations (email/reset), timestamps.
- **Course** (`backend/src/models/Course.js`): title, description, instructor (ref User), lessons [ref Lesson], isPublished, timestamps.
- **Lesson** (`backend/src/models/Lesson.js`): title, order (unique par course via index `{course, order}`), validationMode (`read|pro|qcm`), description, course (ref), timestamps.
- **Quiz** (`backend/src/models/Quiz.js`): title, passingScore (0-100, def 70), lesson (ref unique: 1 quiz/lesson), questions [ref], timestamps.
- **Question** (`backend/src/models/Question.js`): text, quiz (ref), answers [ref], timestamps.
- **Answer** (`backend/src/models/Answer.js`): text, isCorrect (bool), question (ref), timestamps.
- **Content** (`backend/src/models/Content.js`): contentType (`video|pdf|doc`), url (vers stockage objet), lesson (ref), index `{lesson,url}` unique, timestamps.
- **UserProgress** (`backend/src/models/UserProgress.js`): user (ref), lesson (ref), status (`not_started|in_progress|completed`), score (0-100), index unique `{user,lesson}`, timestamps.

Notes:
- Fichiers binaires (PDF/vidéos) ne sont pas stockés en DB — respecter la règle projet: stockage OVH Object Storage, on ne conserve que les URLs.

---

## D) Catalogue d’API (principales routes)

Base: `/api/v1` (cf. montage dans `backend/src/index.js`). Alias: `/api/v1/modules` pointe vers les mêmes routes que `/api/v1/courses`.

- **Auth** (`/auth`, public sauf mention):
  - `POST /register` — crée un utilisateur, envoie email de vérification.
  - `POST /login` — retourne `{ token, user }` si email vérifié.
  - `GET /verify-email/:token` — vérifie le courriel.
  - `POST /resend-verification` — renvoie l’email de vérification.
  - `POST /forgot-password` — envoie email avec lien de réinitialisation.
  - `PUT /reset-password/:token` — réinitialise le mot de passe.
  - `GET /me` — [protect] renvoie l’utilisateur courant.
  - `POST /logout` — [protect] invalide côté client (nettoyage token côté UI).

- **Courses / Modules** (`/courses` et `/modules`):
  - `GET /` — [protect] liste des cours (filtrage côté contrôleur selon rôle: joueur -> publiés, instructeur/admin -> tous/propres; cf. implémentation).
  - `POST /` — [instructor|admin] crée un cours.
  - `GET /:id` — [protect] détail d’un cours.
  - `PUT /:id` — [instructor|admin] met à jour.
  - `DELETE /:id` — [instructor|admin] supprime.

- **Lessons** (principalement imbriquées sous un cours): `/courses/:courseId/lessons`
  - `GET /` — [protect] liste des leçons d’un cours.
  - `POST /` — [instructor|admin] ajoute une leçon.
  - `GET /:id` — [protect] détail.
  - `PUT /:id` — [instructor|admin] met à jour.
  - `DELETE /:id` — [instructor|admin] supprime.

- **Contents** (contenus d’une leçon): `/lessons/:lessonId/contents`
  - `GET /` — [protect] liste des contenus.
  - `POST /` — [instructor|admin] ajoute.
  - `GET /:id` — [protect]
  - `PUT /:id` — [instructor|admin]
  - `DELETE /:id` — [instructor|admin]

- **Quizzes** (unique par leçon): `/lessons/:lessonId/quiz`
  - `GET /` — [protect] récupère le quiz de la leçon.
  - `POST /` — [instructor|admin] crée.
  - `PUT /:id` — [instructor|admin] met à jour.
  - `DELETE /:id` — [instructor|admin] supprime.
  - `POST /:id/submit` — [player] soumet les réponses, calcule score, met à jour `UserProgress`.

- **Questions** (d’un quiz): `/quizzes/:quizId/questions`
  - `GET /` — [protect]
  - `POST /` — [instructor|admin]
  - `GET /:id` — [protect]
  - `PUT /:id` — [instructor|admin]
  - `DELETE /:id` — [instructor|admin]

- **Answers** (d’une question): `/questions/:questionId/answers`
  - `GET /` — [protect]
  - `POST /` — [instructor|admin]
  - `GET /:id` — [protect]
  - `PUT /:id` — [instructor|admin]
  - `DELETE /:id` — [instructor|admin]

- **Progress** (`/progress`):
  - `PATCH /lessons/:lessonId/read` — [player] marque comme lu.
  - `PATCH /lessons/:lessonId/pro-validate` — [instructor|admin] validation pro.
  - `GET /me` — [protect] progression de l’utilisateur courant.

- **Santé (hors /api)**:
  - `GET /health` — état serveur/DB (non proxifié par défaut par Nginx, cf. §2).

Notes:
- Les routes `lessons`, `quizzes`, `questions`, `answers`, `contents` existent aussi au niveau racine (`/api/v1/lessons` etc.) via montage direct, mais l’usage imbriqué est recommandé (contexte parent explicite).

---

## E) RBAC — Matrice des autorisations (résumé)

- **Courses**: lire [player|instructor|admin], créer/éditer/supprimer [instructor|admin].
- **Lessons/Contents/Quizzes/Questions/Answers**: lire [player|instructor|admin], créer/éditer/supprimer [instructor|admin].
- **Progress**: marquer lu [player], valider pro [instructor|admin], lire ma progression [player|instructor|admin] (pour soi).
- **Auth**: endpoints publics vs `/me`/`logout` protégés.

Remarque: actuellement, `authorize('instructor','admin')` ne vérifie pas la propriété (ownership) d’une ressource. Recommandation: ajouter un contrôle d’appartenance (ex.: course.instructor == req.user.id) pour restreindre un instructeur à ses ressources.

---

## F) Conformité sécurité (alignée sur `global_rules.md`)

- **Hashing**: `bcrypt` sur mots de passe (`User.password`, `select:false`).
- **Auth**: JWT signé via `JWT_SECRET` (env), middleware `protect` + `authorize` (RBAC strict serveurs).
- **Entrées**: `express-validator` sur auth; Mongoose pour requêtes paramétrées (prévention injection NoSQL: n’exposez jamais d’opérateurs bruts depuis le client).
- **CORS & headers**: `helmet` + CORS restreint par env; Nginx ajoute CSP/HSTS/X-Frame-Options/Referrer-Policy/X-Content-Type-Options.
- **Rate limiting**: global + spécifiques auth/register/forgot/verify (`backend/src/middleware/rateLimiters.js`).
- **Secrets**: variables d’environnement (.env/.env.prod), aucun secret en dur.
- **Logs**: Winston + Morgan, sans données sensibles; niveaux pilotés par `LOG_LEVEL`.
- **Fichiers**: pas de binaires en DB; URLs pointent vers stockage objet OVH (voir politique projet).
- **Opérations**: endpoints 4xx/5xx ne divulguent pas d’infos sensibles; messages génériques en cas d’échec auth/limite.

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
- Nginx (SPA + proxy) (`frontend/nginx/default*.conf`):
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

7) Tests rapides HTTP (depuis votre poste)
- SPA: `http://NEW_IP/` doit renvoyer l’app.
- API via proxy: `curl http://NEW_IP/api/v1/auth/login -i` (attendu 400 si corps manquant).
- Santé backend (non proxifié par défaut): option A — `docker exec -it fairway-backend curl -s http://localhost:5000/health`.
  - Option B — ajouter en Nginx: `location = /health { proxy_pass http://backend:5000/health; }`.

8) HTTPS/TLS
- Recommandé: reverse proxy TLS externe (Nginx/Traefik/Caddy) gérant certificats Let’s Encrypt et pointant vers FRONTEND 80.
- Alternative: activer 443 dans le conteneur Nginx et monter les certificats. Mettre à jour HSTS/CSP si nécessaire.

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
- Nginx: `frontend/nginx/default.conf`, `frontend/nginx/default.prod.conf`
- Compose: `docker-compose.yml`, `docker-compose.prod.yml`
