# API — Settings (Tuiles du Dashboard)

Endpoints pour gérer des contenus clés/valeurs (texte + média optionnel) destinés aux tuiles publiques du dashboard.

Base path: `/api/settings`

## Lecture publique (whitelist)

GET `/api/settings/public/:key`

- Accès: public
- Paramètres:
  - `:key` ∈ { `dashboard.green_card_schedule`, `dashboard.events` }
- Réponse 200:
```json
{
  "status": "success",
  "data": {
    "setting": {
      "key": "dashboard.events",
      "content": "...",
      "mediaFileName": "file.pdf",
      "mediaUrl": "https://...signed-url...",
      "updatedAt": "2025-08-31T17:00:00.000Z"
    }
  }
}
```

## Admin (lecture/écriture)

GET `/api/settings/:key`

- Accès: JWT + rôle `admin`
- Paramètres: `:key` libre mais usage attendu: `dashboard.*`
- Réponse 200: même format que la lecture publique (sans restriction de clé)

PUT `/api/settings/:key`

- Accès: JWT + rôle `admin`
- Body:
```json
{
  "content": "Texte facultatif",
  "mediaFileName": "nom-dans-Object-Storage-ou-null"
}
```
- Réponse 200:
```json
{
  "status": "success",
  "data": { "setting": { /* comme ci-dessus + mediaUrl signé si applicable */ } }
}
```

## Dépréciation communications publiques

- `GET /api/public/communications` → renvoie `410 Gone`
- Remplacement: utiliser
  - `GET /api/settings/public/dashboard.green_card_schedule`
  - `GET /api/settings/public/dashboard.events`

## Sécurité

- URLs signées pour `mediaFileName` via le service de stockage.
- RBAC strict (admin pour écriture), whitelisting des clés côté public.
- Pas de secrets dans les réponses.
