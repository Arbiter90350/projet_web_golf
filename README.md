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
  - `docs/vps-hardening.md`  guide de durcissement VPS (SSH/UFW/Fail2ban/updates)

## Configuration d'environnement (API URL)

Pour éviter les erreurs d'appels API (401/404/ECONNREFUSED), alignez la variable `VITE_API_URL` selon le mode d'exécution:

- Dev local (Vite + backend en local, port 5000):
  - Fichier: `frontend/.env.development`
  - Valeur: `VITE_API_URL=http://localhost:5000/api/v1`
- Docker (docker-compose):
  - Le backend écoute en conteneur 5000, exposé sur l'hôte 5001 (`ports: "5001:5000"`).
  - Valeur par défaut transmise au build frontend: `http://localhost:5001/api/v1` (voir `docker-compose.yml`).
- Production (même origine via Nginx):
  - Servir le frontend et proxy `/api` vers le backend.
  - Valeur recommandée: `VITE_API_URL=/api/v1`.

Note: le client Axios normalise l'URL et ajoute `/api/v1` si absent (`frontend/src/services/api.ts`).

## Workflow Git et CI/CD

- Développer sur une branche `feature/*`.
- Ouvrir une Pull Request (PR) vers `main`.
- La CI GitHub Actions doit passer au vert avec les checks stricts requis:
  - `frontend-build`
  - `backend-install`
- Merge en mode « squash » (historique linéaire garanti). La suppression de la branche est réalisée après merge.
- Option: activer l’auto‑merge sur la PR (`gh pr merge --squash --delete-branch --auto`) pour merger automatiquement dès que la CI est verte.

Procédure type:
```bash
git switch -c feature/ma-fonctionnalite
# ... commits ...
git push -u origin feature/ma-fonctionnalite
gh pr create -B main -H feature/ma-fonctionnalite -t "feat: ..." -b "..."
gh pr merge --squash --delete-branch --auto
```

## Protections de branche (GitHub)

- PR obligatoire pour modifier `main` (push direct interdit).
- Status checks requis (mode strict): `frontend-build`, `backend-install`.
- Reviews non obligatoires (CODEOWNERS présent mais non bloquant).
- Historique linéaire imposé (merge commit interdit, squash recommandé).
- Conversations à résoudre avant merge, force‑push interdit.

## Sécurité opérationnelle (rappels)

- Secrets via variables d’environnement uniquement; `.env` ignoré.
- Authentification JWT, mots de passe hashés avec `bcrypt`.
- RBAC strict côté serveur (`player` | `instructor` | `admin`).
- Middlewares: `helmet` (en‑têtes), `cors` (origines limitées), `express-rate-limit` (points sensibles).
- Validation d’entrée systématique (`express-validator`), requêtes DB via Mongoose (prévention NoSQL injection).
- Logs structurés sans données sensibles; surveillance des endpoints sensibles.
- Fichiers binaires (PDF/vidéos): stockage externe (OVH Object Storage), jamais en base de données.
