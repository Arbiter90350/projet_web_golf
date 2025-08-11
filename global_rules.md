# Règles Globales — Fairway Progress Hub

## Partie 1 — Lois et Principes Directeurs

- Conformité stricte au Contrat et au Devis. Hors périmètre interdit sans validation explicite.
- Stack non négociable (cf. Contraintes non négociables).
- Sécurité prioritaire (bcrypt, JWT, RBAC, prévention NoSQL, XSS/CSRF, variables d’environnement).
- Qualité & modularité: code propre, modulaire (routes, contrôleurs, modèles, services, middlewares), et systématiquement commenté en français.
- Variables d’environnement: aucun secret en dur. `.env` obligatoire en dev, gestion de secrets sécurisée en prod.
- Commits atomiques avec messages clairs en anglais (ex: `feat: implement user login endpoint`).
- Rapport d’exécution après chaque prompt: résumé des actions et fichiers impactés.

## Mandatory v2 — Outcome‑driven et permissif pour modèles avancés

### 1) Contraintes non négociables (hard constraints)
- Stack technique:
  - Backend: Node.js + Express.js
  - Frontend: React (Vite)
  - Base de données: MongoDB + Mongoose
  - Serveur prod frontend: Nginx
- Sécurité:
  - Hash: bcrypt
  - Auth: JWT + RBAC strict côté serveur
  - NoSQL injection: uniquement via Mongoose et requêtes paramétrées
  - XSS/CSRF: protections applicatives et en‑têtes
  - Secrets via variables d’environnement uniquement
- Périmètre:
  - Respect strict du cahier des charges (Contrat/Devis)
  - Aucune fonctionnalité hors périmètre sans validation préalable
- Spécifiques projet:
  - Fichiers (vidéos/PDF) sur OVH Object Storage (jamais en DB)
  - Pas d’exposition d’informations sensibles par l’API
  - Journal des actions sensibles + rate limiting
  - États explicites de progression côté backend
  - i18n: clés de traduction (pas de chaînes en dur)

### 2) Objectif de résultat (qualité et production)
- Application professionnelle, prête pour la production.
- Performance: pagination si volumétrie, index Mongo pertinents, assets optimisés via Nginx.
- Sécurité: bonnes pratiques actuelles, audits réguliers, journalisation utile.
- Robustesse: validations serveur, tests unitaires sur fonctions critiques, contrôle d’accès systématique.

### 3) Flexibilité pour modèles avancés
- Initiative autorisée si:
  - Aucune contrainte non négociable n’est enfreinte
  - Le gain (sécurité, performance, maintenabilité, UX) est clair et mesurable
  - Compatibilité stack et APIs maintenue
- Toute déviation est documentée (raison, impact, rollback possible).
- Maintenabilité: architecture par couches, commentaires en français, conventions internes respectées.

### 4) Processus de décision et validation
- Évolutions impactant périmètre/API/UX: rédiger un ADR court (contexte, options, décision, impacts) et obtenir validation PO.
- Optimisations internes (techniques): autorisées si conformes aux contraintes, documentées dans le code/README technique.

### 5) Exigences de livraison
- Commits: atomiques, messages conventionnels (anglais).
- Documentation: endpoints (requêtes/réponses/erreurs), variables d’environnement, ADRs.
- Tests: unitaires sur fonctions critiques et RBAC; cas limites (auth/QCM/progression).
- Observabilité & sécurité opérationnelle: logs structurés (sans données sensibles), rate limiting anti brute‑force aux points critiques.

### 6) Interdictions
- Secrets en dur (JWT, URIs, API keys)
- Stockage de fichiers binaires en base de données
- Bypass des autorisations côté serveur
- Exposition d’informations sensibles dans les réponses API

## Vigilances nécessaires (par maillon)

- Backend (Node.js + Express)
  - Validation d’entrée: `express-validator`; ne jamais faire confiance au client.
  - Sécurité middleware: `helmet`, `cors` (origines limitées), `express-rate-limit` (login/reset).
  - RBAC strict: auth JWT puis autorisation par rôle (`player` | `instructor` | `admin`).
  - Gestion d’erreurs centralisée: middleware avec codes adaptés, messages non sensibles, logs utiles.
  - Journalisation: logs structurés (Pino/Winston) + `morgan` HTTP; pas de données sensibles dans les logs.
  - Config/Secrets: chargeur + validation d’environnement, fail fast si manquant.
  - Tâches CPU/batch: déporter (BullMQ + Redis) pour emails/exports/traitements lourds.

- Frontend (React + Vite)
  - Guards de routes: redirections selon auth/roles; protection des pages privées.
  - Intercepteurs API: instance Axios (token, timeouts, retry/backoff, 401→logout).
  - Validation formulaire: `react-hook-form` + `zod` (cohérence FE/BE).
  - i18n: clés de traduction + fallback; ne jamais afficher de données sensibles.
  - Performance UX: code splitting, lazy routes, suspense; éviter surcharges initiales.

- MongoDB + Mongoose
  - Indexation: uniques (email), TTL (tokens), composés si besoin; revue régulière.
  - Requêtes sûres: empêcher injection d’opérateurs `$`; requêtes paramétrées uniquement.
  - Validation schéma: strict, valeurs par défaut, `select: false` pour champs sensibles.
  - Migrations: outils (ex: `migrate-mongo`), scripts idempotents.
  - Cohérence: transactions si critique; `populate` mesuré; `lean()` pour lectures.

- Nginx (serveur prod frontend)
  - En‑têtes sécurité: CSP, HSTS, X‑Frame‑Options, Referrer‑Policy, X‑Content‑Type‑Options.
  - Performance: HTTP/2/3, gzip/brotli, Cache‑Control (immutable), ETag.
  - Reverse proxy: timeouts/buffers/websocket; rate limit côté edge.
  - SPA fallback: `try_files` → `index.html` pour routage client.

## Maillons complémentaires recommandés

- Standardisation code
  - ESLint + Prettier + EditorConfig.
  - Hooks Git (Husky): pre‑commit (lint/test), commitlint (conventionnel).
  - Arborescence: `routes/`, `controllers/`, `services/`, `models/`, `middlewares/`, `utils/`.

- Gestion d’environnement
  - `.env.example` exhaustif; validation au démarrage (envalid/zod) → fail fast.
  - Secrets prod via coffre/secret manager (pas de `.env` en prod).

- Conteneurisation & Dev local
  - Docker Compose (API, MongoDB, Redis, Nginx).
  - Scripts make/npm pour `dev`, `lint`, `test`, `seed`, `migrate`, `start`.

- Sécurité renforcée
  - Rate limiting avec store distribué (Redis) si horizontal.
  - CORS strict (whitelist d’origines, credentials si besoin).
  - Sanitization (XSS/HTML) côté BE/FE selon surfaces d’entrée.
  - Audit des dépendances (npm audit/Snyk) en CI.

- Observabilité
  - Logs structurés (corrélation reqId), rotation/retention.
  - Metrics (Prometheus): latence, taux d’erreurs, saturation; endpoints `/healthz`.
  - Alerte erreurs: Sentry (FE/BE).

- Documentation & QA
  - OpenAPI/Swagger pour l’API; exemples de requêtes/réponses/erreurs.
  - Collections Postman/Insomnia versionnées.
  - Tests: BE (Jest + supertest + MongoMemoryServer), FE (React Testing Library + MSW).
  - ADR courts pour décisions techniques.

- Fichiers & médias (OVH Object Storage)
  - Validation MIME/taille, noms uniques, antivirus si requis.
  - URLs signées (upload/download) côté serveur; interdiction d’accès public non contrôlé.

- Emails transactionnels
  - SendGrid + templates; configuration SPF/DKIM/DMARC; pages FE pour liens d’action.

- Auth & tokens
  - JWT avec expiration; rotation si nécessaire; listes (black/allow) pour cas sensibles.
  - Stockage token FE: Authorization header; éviter localStorage si XSS; privilégier mémoire/refresh si requis.
  - Journalisation des événements sensibles (login, reset, changements profil/role).

## Snippets de référence

- Express — sécurité de base
```js
app.use(helmet());
app.use(cors({ origin: process.env.FRONTEND_URL, credentials: true }));
app.use(rateLimit({ windowMs: 15*60*1000, max: 200 }));
app.use(express.json({ limit: '1mb' }));
```

- Nginx — CSP minimale (exemple)
```nginx
add_header Content-Security-Policy "default-src 'self'; script-src 'self' 'nonce-$request_id'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; connect-src 'self' https://api.example.com" always;
```

- Validation `.env` (envalid)
```ts
import { cleanEnv, str, num } from 'envalid';
export const env = cleanEnv(process.env, {
  NODE_ENV: str({ choices: ['development','test','production'] }),
  PORT: num({ default: 3000 }),
  MONGO_URI: str(),
  JWT_SECRET: str(),
  FRONTEND_URL: str(),
  SENDGRID_API_KEY: str(),
  EMAIL_FROM: str(),
});
```

## Règles spécifiques au projet (rappel)

1) RBAC
- Rôles: `player`, `instructor`, `admin`.
- Vérification des autorisations côté serveur à chaque endpoint; ne jamais se fier au client.

2) Gestion des fichiers
- Stockage exclusif sur OVH Object Storage; jamais en base de données.
- Validation type/taille; noms uniques.

3) Parcours pédagogique
- Progression séquentielle stricte; historique des validations/scores.

4) Sécurité des données
- Requêtes Mongoose paramétrées; aucune donnée sensible exposée; logs d’actions sensibles; rate limiting.

5) Gestion des états
- Cohérence FE/BE; statuts explicites: `not_started`, `in_progress`, `completed`; validations serveur.

6) Documentation
- Documenter chaque endpoint (exemples); journal des décisions; variables d’environnement.

7) Tests
- Unitaires pour fonctions critiques; cas limites (QCM/validation); contrôles d’accès.

8) Performance
- Index Mongo adaptés; pagination; lazy‑loading médias lourds.

9) Gestion des erreurs
- Messages clairs et non techniques; logs serveur contextualisés; gestion propre des erreurs réseau.

10) Internationalisation (i18n)
- Préparer la structure; pas de chaînes en dur; utiliser des clés de traduction.
