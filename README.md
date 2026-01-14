# 🎓 SupNum Exam Manager - Système d'Examen Sécurisé

Bienvenue dans le projet **SupNum Exam Manager**. Cette plateforme moderne et sécurisée est conçue pour la gestion complète du cycle des examens, de la création à l'évaluation, avec une surveillance en temps réel avancée.

![SupNum Logo](frontend/public/logo_supnum.png)

## ✨ Caractéristiques Principales

### 🏛️ Architecture Multi-Portails
- **Portail Étudiant :** Interface épurée pour passer les examens, soumettre les travaux et consulter les résultats.
- **Portail Professeur :** Tableau de bord SaaS moderne pour la création d'examens, la gestion des ressources et la surveillance en direct.
- **Portail Administrateur :** Gestion centralisée des utilisateurs (Étudiants, Professeurs, Admins) et des archives.

### 🔒 Sécurité et Anti-Triche Pro-actifs
- **Détection de Fraude :** Surveillance en temps réel des changements d'onglets, sorties de plein écran et déconnexions.
- **Alertes Instantanées :** Notification immédiate des professeurs via WebSockets en cas de comportement suspect.
- **Contrôle d'Accès :** Gestion granulaire des accès aux examens par salle et par étudiant.

### 🎨 Expérience Utilisateur Moderne
- **Design SaaS :** Interface basée sur le Glassmorphisme avec des animations fluides (Framer Motion).
- **Responsive Design :** Optimisé pour tous les écrans, du mobile au desktop.
- **Identité Visuelle :** Intégration complète de la charte graphique SupNum.

## 📁 Structure du Projet

- `backend/` : Serveur Node.js/Express, API REST, WebSockets (Socket.io), base de données SQLite.
- `frontend/` : Application Next.js (App Router), Tailwind CSS, TypeScript.

## 🚀 Installation & Lancement

### Prérequis
- Node.js (v18+)
- npm

### 1. Configuration du Backend
```bash
cd backend
npm install
node database_init.js
npm run dev
```

### 2. Configuration du Frontend
```bash
cd frontend
npm install
npm run dev
```
Accès : [http://localhost:3000](http://localhost:3000)

## 🛠️ Stack Technique
- **Frontend :** Next.js, Tailwind CSS, Lucide React, Framer Motion.
- **Backend :** Express, Socket.io, SQLite (Drizzle/Better-SQLite3), JWT.

---
© 2026 Institut Supérieur du Numérique (SupNum). Tous droits réservés.
