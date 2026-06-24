# Projet I - Plateforme d'Examens avec IDE Intégré

Ce projet est une plateforme de gestion et de passage d'examens de programmation avec un IDE en ligne intégré pour les étudiants.

## 🛠️ Prérequis

Avant de commencer, assurez-vous d'avoir installé sur votre machine :
1. **Node.js** (v18 ou supérieur recommandé)
2. **MongoDB** (requis pour l'IDE étudiant et les logs d'exécution)
   - Vous pouvez l'installer localement ou utiliser une instance Docker / Atlas.
   - Par défaut, l'application cherche MongoDB sur `mongodb://localhost:27017/pse`.

---

## 🚀 Guide d'installation et de démarrage rapide

Suivez scrupuleusement ces étapes pour lancer le projet sans erreur sur votre machine :

### 1. Configuration des variables d'environnement

#### Backend :
1. Allez dans le dossier `backend`.
2. Copiez le fichier `.env.example` et renommez-le en `.env`.
3. Assurez-vous que les variables suivantes sont correctes pour votre environnement (notamment la chaîne de connexion MongoDB `MONGO_URI` si elle diffère de celle par défaut).

#### Frontend :
1. Allez dans le dossier `frontend`.
2. Copiez le fichier `.env.example` et renommez-le en `.env` (ou `.env.local`).
3. Les valeurs par défaut pointent vers `http://localhost:3001`, ce qui est correct pour le développement.

---

### 2. Installation des dépendances

Ouvrez deux terminaux différents ou exécutez ces commandes :

#### Terminal 1 : Backend
```bash
cd backend
npm install
```

#### Terminal 2 : Frontend
```bash
cd frontend
npm install
```

---

### 3. Démarrage des bases de données et des serveurs

1. **Lancez MongoDB** (si ce n'est pas déjà fait en arrière-plan) :
   - Sous Windows, assurez-vous que le service MongoDB est démarré.
   - Ou via Docker : `docker run -d -p 27017:27017 --name local-mongo mongo:latest`

2. **Démarrez le Backend** (Terminal 1) :
   ```bash
   cd backend
   npm run dev
   ```
   *Note : Au premier démarrage, SQLite se connecte automatiquement au fichier `database.db` fourni et applique les migrations/seeds par défaut si nécessaire.*

3. **Démarrez le Frontend** (Terminal 2) :
   ```bash
   cd frontend
   npm run dev
   ```

L'application frontend est maintenant accessible sur [http://localhost:3000](http://localhost:3000).

---

## 🔑 Comptes de Test pré-configurés

La base de données SQLite inclut par défaut les comptes suivants pour tester l'application immédiatement :

* **Administrateur** :
  - **Email** : `admin@supnum.mr`
  - **Mot de passe** : `admin`
* **Professeur** :
  - **Email** : `professor@supnum.mr`
  - **Mot de passe** : `password123`
* **Étudiant** :
  - **Email** : `student@supnum.mr` (Matricule: `24001`)
  - **Mot de passe** : `password123`

---

## 📄 Note sur l'affichage des Sujets d'Examens (PDF)

Pour que l'affichage des sujets fonctionne correctement :
1. Les fichiers PDF des sujets sont stockés sous `backend/uploads/exams/`.
2. Le sujet de test pour l'examen 30 (`1782159333873_2023-2024.pdf`) est déjà inclus dans le dépôt sous `backend/uploads/exams/30/` pour garantir son affichage direct.
3. Helmet et les en-têtes CORS sont configurés dans `backend/src/server.js` pour permettre l'intégration des PDF dans les iframes de l'IDE étudiant sans blocage de sécurité.
