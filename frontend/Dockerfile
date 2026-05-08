FROM node:20-alpine

WORKDIR /app

COPY package*.json ./

# Installer toutes les dépendances pour le build
RUN npm install

COPY . .

# Pas de variables d'environnement en dur pour le build, utilisation de l'URL dynamique du navigateur

# Build Next.js
RUN npm run build

EXPOSE 3000

CMD ["npm", "start"]
