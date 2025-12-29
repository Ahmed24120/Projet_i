# Backend - Système d'Examen Sécurisé

Ce dossier contient le code source du backend pour le système d'examen sécurisé.

## 🛠️ Technologies
- **Node.js** & **Express**
- **SQLite** (via Prisma ou accès direct selon config)
- **WebSockets** (Socket.io) pour la surveillance en temps réel
- **Bcrypt** pour le hachage des mots de passe

## 🚀 Installation

1. Accédez au dossier backend :
   ```bash
   cd backend
   ```

2. Installez les dépendances :
   ```bash
   npm install
   ```

## ⚙️ Configuration

Assurez-vous d'avoir un fichier `.env` si nécessaire (voir `.env.example`).
Initialisez la base de données si c'est la première fois :
```bash
node database_init.js
```

## 🏃 Lancement

Lancer le serveur en mode développement :
```bash
npm run dev
```

Le serveur sera accessible sur port 5000 (ou celui configuré).

## 📁 Structure
- `src/` : Code source des routes et de la logique
- `database.db` : Base de données SQLite (ignorée par git, à créer)
- `uploads/` : Dossier pour les fichiers téléchargés (captures d'écran anti-triche)
