# Définir l'image de base
FROM node:18-alpine

# Créer et définir le répertoire de travail
WORKDIR /app

# Copier les fichiers de dépendances
COPY package*.json ./

# Installer les dépendances de production uniquement
RUN npm install --only=production

# Copier le code source
COPY . .

# Exposer le port de l'application
EXPOSE 5000

# Définir les variables d'environnement
ENV NODE_ENV=production

# Script d'entrée: peut exécuter un seed conditionnellement puis démarrer l'app
RUN chmod +x ./docker-entrypoint.sh || true

# Commande de démarrage
CMD ["./docker-entrypoint.sh"]
