# Définir l'image de base
FROM node:18-alpine

# Créer et définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances de production uniquement
RUN npm install --only=production

# Utilitaires nécessaires (ex: curl pour healthcheck)
RUN apk add --no-cache curl

# Copier le code source
COPY . .

# Exposer le port de l'application
EXPOSE 5000

# Définir les variables d'environnement
ENV NODE_ENV=production

# Normalize line endings and ensure entrypoint is executable (fix CRLF issues on Alpine)
RUN sed -i 's/\r$//' ./docker-entrypoint.sh && chmod +x ./docker-entrypoint.sh

# Commande de démarrage (via sh pour robustesse)
CMD ["sh", "./docker-entrypoint.sh"]
