# ADR — Remplacer les communications par des réglages de tuiles + module Notifications Push

Date: 2025-08-31
Statut: Accepté

## Contexte

L’ancienne fonctionnalité « communications » était utilisée implicitement pour alimenter 2 tuiles du dashboard (événements et horaire carte verte) via un listing paginé public. Ce design était jugé confus (surcharge fonctionnelle, logique implicite, couplage fort FE/BE sur un endpoint générique).

## Décision

- Déprécier l’API publique de communications et la remplacer par un modèle simple « Setting » clé/valeur pour les tuiles:
  - `dashboard.green_card_schedule`
  - `dashboard.events`
- Exposer:
  - Lecture publique restreinte par clé: `GET /api/settings/public/:key` (whitelist côté serveur)
  - Lecture/écriture admin: `GET/PUT /api/settings/:key`
- Ajouter un module « Notifications Push » (UI seule pour l’instant) côté admin, en prévision d’une implémentation ultérieure côté backend (envoi + historique).

## Motivations

- Simplicité UX: 2 tuiles explicites et éditables.
- Sécurité: surface publique réduite, whitelisting de clés, URLs signées pour médias.
- Maintenabilité: découplage clair, code et responsabilités mieux séparés.

## Impacts

- Frontend:
  - Dashboard lit désormais 2 endpoints `settings/public` (événements, horaire).
  - Nouvelle page `AdminTilesPage` (édition des 2 tuiles) et `AdminPushNotificationsPage` (squelette UI).
  - Menu admin mis à jour (Tuiles, Notifications Push).
- Backend:
  - Nouveau modèle `Setting`, contrôleur et routes `/api/settings`.
  - Endpoint `GET /api/public/communications` renvoie `410 Gone` (déprécié) avec guidance.

## Alternatives considérées

- Conserver le modèle « communications » + filtres pour 2 tuiles: rejeté (ambigu, trop générique).
- Ajouter des types/flags sur communications: rejeté (alourdit sans clarifier, toujours implicite).

## Sécurité & conformité projet

- Auth JWT + RBAC strict côté serveur (admin pour écriture).
- Pas de secrets en dur, variables d’environnement uniquement.
- Prévention NoSQL injection (Mongoose), URLs signées pour médias.

## Rollback

- Restaurer l’endpoint public des communications (retirer 410) et rétablir l’usage FE précédent.
- Supprimer le modèle `Setting` et les routes associées.

