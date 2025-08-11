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

