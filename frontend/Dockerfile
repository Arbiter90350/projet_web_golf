# Étape de build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
# Construire l'application
ARG VITE_API_URL
# Expose la variable au process de build Vite (import.meta.env)
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

# Étape de production
FROM nginx:stable-alpine AS production
COPY --from=builder /app/dist /usr/share/nginx/html
COPY nginx/default.conf /etc/nginx/conf.d/default.conf
EXPOSE 80
CMD ["nginx", "-g", "daemon off;"]
