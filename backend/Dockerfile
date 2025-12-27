FROM node:18-alpine

WORKDIR /app

# Dépendances système pour SQLite et compilation
RUN apk add --no-cache python3 make g++ sqlite

COPY package*.json ./

RUN npm install --production

COPY . .

# Création des dossiers nécessaires
RUN mkdir -p uploads/exams

EXPOSE 3001

CMD ["node", "src/server.js"]
