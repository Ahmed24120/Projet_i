# 🎓 Système d'Examen Sécurisé

Bienvenue dans le projet de système d'examen sécurisé. Ce projet comprend un **Backend** (API & WebSockets) et un **Frontend** (Interface Next.js).

## 📁 Structure du Projet

- `backend/` : Serveur Express, gestion de la base de données et communications temps réel.
- `frontend/` : Application Next.js pour les étudiants et les professeurs.

---

## 🚀 Installation & Lancement Rapide

Pour commencer, clonez le projet et suivez les étapes ci-dessous.

### 1. Configuration du Backend

1. **Accédez au dossier :**
   ```bash
   cd backend
   ```

2. **Installez les dépendances :**
   ```bash
   npm install
   ```

3. **Initalisez la base de données :**
   ```bash
   node database_init.js
   ```

4. **Lancez le serveur :**
   ```bash
   npm run dev
   ```
   *Le serveur tourne généralement sur le port 5000.*

---

### 2. Configuration du Frontend

1. **Ouvrez un nouveau terminal et accédez au dossier :**
   ```bash
   cd frontend
   ```

2. **Installez les dépendances :**
   ```bash
   npm install
   ```

3. **Lancez l'application :**
   ```bash
   npm run dev
   ```
   *L'application est accessible sur [http://localhost:3000](http://localhost:3000).*

---

## 🛠️ Technologies Utilisées

- **Backend :** Node.js, Express, Socket.io, SQLite, Bcrypt.
- **Frontend :** Next.js 15, Tailwind CSS, Lucide React.

## 🔒 Fonctionnalités Anti-Triche
- Surveillance en temps réel des étudiants.
- Détection de changement d'onglet/fenêtre.
- Alertes instantanées pour le professeur.

---


