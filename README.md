# Fairway Progress Hub

Plateforme de suivi de progression golfique.

## Stack et Architecture
- Backend: Node.js + Express.js, MongoDB + Mongoose
- Frontend: React (Vite)
- S�curit�: bcrypt, JWT, RBAC, helmet, cors, rate limiting
- CI/CD: GitHub Actions (`.github/workflows/ci.yml`)
- Gouvernance: CODEOWNERS, protections de branche `main`

Arborescence (extrait):
- `backend/` � API Express, d�pendances Mongoose/Express
- `frontend/`  App React/Vite
- `.github/workflows/ci.yml`  pipeline CI
- `docs/`  documentation projet

## Workflow Git
- D�velopper sur branche feature: `feature/*`
- Ouvrir une PR vers `main`
- CI (checks stricts: `frontend-build`, `backend-install`) doit �tre verte
- Merge (squash), suppression automatique de la branche
- Reviews non obligatoires (CODEOWNERS non bloquant)

## CI/CD
- Job `backend-install`: `npm ci` dans `backend/`
- Job `frontend-build`: `npm ci` + build dans `frontend/`
- Status checks requis et stricts sur `main`

## Fonctionnalit�s en place
- D�p�t initialis�, arborescence frontend/backend
- CI GitHub Actions op�rationnelle (backend install + frontend build)
- Protection de branche `main` (PR obligatoire, checks stricts, historique lin�aire, pas de forcepush)
- Fichier `CODEOWNERS` global (`@Arbiter90350 @Melonil`)  non bloquant
- `.env` ignor�, secrets via GitHub Secrets

## Roadmap (logiques m�tier � impl�menter)
- Authentification et r�les (JWT + bcrypt, RBAC serveur: `player` | `instructor` | `admin`)
- Mod�le utilisateur (email unique, indexations, validations)
- Parcours/Progression: �tats explicites, r�gles de progression, historisation
- Sessions d�entra�nement, drills, scoring; tableaux de bord de progression
- QCM/�valuations et suivi des r�sultats
- Stockage des m�dias (PDF/vid�os) sur OVH Object Storage (jamais en DB)
- Notifications email (ex: SendGrid/SMTP) avec anti brute-force sur endpoints sensibles
- Journalisation structur�e et audit (sans donn�es sensibles)
- S�curit�: headers (helmet), CORS restreint, rate limiting cibl�, validation dentr�e (`express-validator`)
- Frontend: pages s�curis�es avec guards, i18n � cl�s, formulaires (`react-hook-form` + `zod`)
- Tests: unitaires (fonctions critiques, RBAC), CI
- Performance: pagination, index Mongo pertinents, `lean()` en lecture
- D�ploiement: Nginx (CSP/HSTS, gzip/brotli, cache), Dockerisation (optionnel)

## D�marrage local (extrait)
- Node/NPM install�s
- `cp .env.example .env` puis compl�ter les variables
- `npm ci` dans `backend/` et `frontend/`
- Lancer chaque partie (scripts � d�finir selon besoins)

## Licences et cr�dits
Projet p�dagogique  configuration CI/CD et protections pr�tes pour it�rations produit.