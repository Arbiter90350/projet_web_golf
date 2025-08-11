# Fairway Progress Hub

Plateforme de suivi de progression golfique.

## Stack et Architecture
- Backend: Node.js + Express.js, MongoDB + Mongoose
- Frontend: React (Vite)
- Sécurité: bcrypt, JWT, RBAC, helmet, cors, rate limiting
- CI/CD: GitHub Actions (`.github/workflows/ci.yml`)
- Gouvernance: CODEOWNERS, protections de branche `main`

Arborescence (extrait):
- `backend/` — API Express, dépendances Mongoose/Express
- `frontend/`  App React/Vite
- `.github/workflows/ci.yml`  pipeline CI
- `docs/`  documentation projet

## Workflow Git
- Développer sur branche feature: `feature/*`
- Ouvrir une PR vers `main`
- CI (checks stricts: `frontend-build`, `backend-install`) doit être verte
- Merge (squash), suppression automatique de la branche
- Reviews non obligatoires (CODEOWNERS non bloquant)

## CI/CD
- Job `backend-install`: `npm ci` dans `backend/`
- Job `frontend-build`: `npm ci` + build dans `frontend/`
- Status checks requis et stricts sur `main`

## Fonctionnalités en place
- Dépôt initialisé, arborescence frontend/backend
- CI GitHub Actions opérationnelle (backend install + frontend build)
- Protection de branche `main` (PR obligatoire, checks stricts, historique linéaire, pas de forcepush)
- Fichier `CODEOWNERS` global (`@Arbiter90350 @Melonil`)  non bloquant
- `.env` ignoré, secrets via GitHub Secrets

## Roadmap (logiques métier à implémenter)
- Authentification et rôles (JWT + bcrypt, RBAC serveur: `player` | `instructor` | `admin`)
- Modèle utilisateur (email unique, indexations, validations)
- Parcours/Progression: états explicites, règles de progression, historisation
- Sessions d’entraînement, drills, scoring; tableaux de bord de progression
- QCM/évaluations et suivi des résultats
- Stockage des médias (PDF/vidéos) sur OVH Object Storage (jamais en DB)
- Notifications email (ex: SendGrid/SMTP) avec anti brute-force sur endpoints sensibles
- Journalisation structurée et audit (sans données sensibles)
- Sécurité: headers (helmet), CORS restreint, rate limiting ciblé, validation dentrée (`express-validator`)
- Frontend: pages sécurisées avec guards, i18n à clés, formulaires (`react-hook-form` + `zod`)
- Tests: unitaires (fonctions critiques, RBAC), CI
- Performance: pagination, index Mongo pertinents, `lean()` en lecture
- Déploiement: Nginx (CSP/HSTS, gzip/brotli, cache), Dockerisation (optionnel)

## Démarrage local (extrait)
- Node/NPM installés
- `cp .env.example .env` puis compléter les variables
- `npm ci` dans `backend/` et `frontend/`
- Lancer chaque partie (scripts à définir selon besoins)

## Licences et crédits
Projet pédagogique  configuration CI/CD et protections prêtes pour itérations produit.