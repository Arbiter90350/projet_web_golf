# Index de Développement — Fairway Progress Hub

Version: 2025-08-11 03:51

Ce document synthétise l’avancement par phases (P1 → Pn), les livrables, et les prochaines étapes. Il sert de référence courte au PO et à l’équipe.

---

## P1 — Fondations (TERMINÉ)

- Backend Node.js/Express initialisé.
- Authentification JWT + hachage bcrypt + RBAC serveur.
- Modèles MongoDB/Mongoose: `User`, `Course`, `Lesson`, `Content`, `Quiz`, `Question`, `Answer`, `UserProgress` (+ index pertinents).
- Routes/contrôleurs CRUD sécurisés (RBAC) pour contenus pédagogiques.
- Docker Compose (DB, backend, frontend via Nginx).
- Qualité/Sécurité: `helmet`, `cors` (origines limitées), `express-rate-limit` global.
- Journalisation HTTP (morgan) reliée à Winston.

## P2 — Auth de bout en bout (TERMINÉ — QA en cours)

- Flux complet Auth: register, login, forgot/reset, vérification email, renvoi d’email de vérification.
- Service email multi-fournisseur: SMTP OVH Exchange (par défaut) + SendGrid (option). Correction `EENVELOPE`.
- Variables `.env` harmonisées + `VITE_API_URL` robuste (inclut `/api/v1`).
- Intercepteurs Axios frontend: ajout token, gestion 401/403 (déconnexion, redirection contrôlée).
- `AuthContext` consolidé (persistance session via `/auth/me`).
- Rate limiting dédié sur routes auth sensibles.
- UI Auth: pages Login/Register/Forgot/Reset alignées sur la charte (layout B, logo officiel).

Points restants P2 (QA):
- Gabarits HTML d’emails (FR) + relecture PO.
- Vérification DNS (SPF/DKIM/DMARC) et tests d’envoi finaux.

## P3 — UX/UI Auth & Robustesse (EN COURS — objectif immédiat)

- Uniformisation complète des pages Auth (Login/Register/Forgot/Reset/Verify) — layout B, logo, palette validée.
- i18n: remplacement des chaînes en dur par des clés.
- Validation formulaires: `react-hook-form` + `zod` (cohérence FE/BE).
- Nginx (prod FE):
  - No‑cache pour `index.html` (éviter bundles obsolètes), cache immutable pour `/assets/*`.
  - En‑têtes sécurité: CSP/HSTS/Referrer‑Policy/etc. (selon contraintes PO/SEO).
- Guards de routes et redirections par rôle (`player` | `instructor` | `admin`).
- Tests unitaires critiques (auth, RBAC) + scénarios d’erreur (403/400).

## P4 — Contenus & Stockage (À VENIR)

- UI de gestion des contenus pédagogiques (courses/lessons/quiz/questions/answers/contents) côté frontend.
- Intégration stockage fichiers (vidéos/PDF) via OVH Object Storage (jamais en base de données).
- États explicites de progression côté backend exposés et consommés côté frontend.
- Pagination/performance et optimisations d’UX (lazy, code splitting, suspense).

---

## Backlog court terme (Prochain sprint)

- [ ] Finaliser et intégrer les gabarits HTML d’emails (FR) + tests d’envoi réels.
- [ ] Nginx: no‑cache `index.html`, immutable `/assets/*` + en‑têtes sécurité (CSP/HSTS/…)
- [ ] Guards de routes + redirections rôle.
- [ ] i18n des pages Auth (toutes les chaînes via clés).
- [ ] Validation formulaires avec `react-hook-form` + `zod`.
- [ ] Tests unitaires (auth/RBAC) + revues de logs (sans données sensibles).

## Environnements et variables

- Voir `.env.example` (commenté en français). Interdiction absolue de secrets en dur.
- Variables clés: `MONGO_URI`, `JWT_SECRET`, `FRONTEND_URL`, `CORS_ORIGINS`, `VITE_API_URL`, `EMAIL_PROVIDER`, `SMTP_*` ou `SENDGRID_*`, `RL_*`, `LOG_LEVEL`.

## Exécution locale (rappel)

```bash
# Démarrer l’ensemble
docker compose up -d

# Rebuild frontend (lors de changements Vite/env/UI)
docker compose build frontend && docker compose up -d frontend

# Logs utiles
docker compose logs -f --tail=100 backend
```

## Notes qualité & sécurité

- Tous les commentaires code en français (contexte projet local). Commits conventionnels (anglais).
- Pas de stockage de binaires en DB. Secrets via variables d’environnement uniquement.
- Journalisation utile sans données sensibles. Rate limiting présent sur endpoints critiques.
