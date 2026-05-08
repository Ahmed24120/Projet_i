# Plateforme d'Examen (Projet_i) - Migration vers PostgreSQL

Ce projet a été migré avec succès d'une base de données SQLite vers **PostgreSQL**.
Le projet est entièrement "Dockerisé" pour garantir que le frontend, le backend et la base de données fonctionnent de manière harmonieuse sans aucune installation complexe sur votre machine hôte.

## 🚀 Prérequis
- [Docker](https://docs.docker.com/get-docker/)
- [Docker Compose](https://docs.docker.com/compose/install/)

---

## 🛠️ Comment démarrer le projet

Puisque le projet est containerisé, vous n'avez besoin que d'une seule commande pour tout lancer (Base de données, Backend, Frontend).

1. Ouvrez votre terminal à la racine du projet (là où se trouve `docker-compose.yml`).
2. Exécutez la commande suivante :
   ```bash
   docker compose up -d --build
   ```

*Cette commande va :*
* *Télécharger l'image de PostgreSQL et initialiser la base de données.*
* *Construire le backend Node.js.*
* *Construire le frontend Next.js.*
* *Démarrer tous les services en arrière-plan (le `-d` signifie detached mode).*

---

## 🌐 Accès aux applications

Une fois les containers démarrés, vous pouvez accéder à :
*   **Interface Web (Frontend)** : [http://localhost:3000](http://localhost:3000)
*   **API (Backend)** : [http://localhost:3001](http://localhost:3001)

### 🔐 Comptes par défaut générés automatiquement
Au démarrage, la base de données est automatiquement peuplée (seeded) avec ces comptes de test :
*   **Administrateur** : `admin@supnum.mr` / Mot de passe : `admin`
*   **Professeur** : `professor@supnum.mr` / Mot de passe : `password123`
*   **Étudiant** : `student@supnum.mr` (ou matricule `24001`) / Mot de passe : `password123`

---

## 🗄️ Travailler avec la Base de Données PostgreSQL

Le projet n'utilise plus de fichier local `database.db`. À la place, toutes les données sont stockées de façon persistante dans le volume Docker de PostgreSQL. 

### Identifiants de connexion (pour DBeaver, pgAdmin, DataGrip, etc.)
Si vous souhaitez observer les tables et les données depuis un gestionnaire de base de données, utilisez les identifiants suivants :

*   **Host / Serveur** : `localhost`
*   **Port** : `5433` *(Le port 5433 est exposé pour ne pas interférer avec d'autres bases PostgreSQL locales tournant sur 5432).*
*   **Database / Base de données** : `projet_i_db`
*   **Username / Utilisateur** : `projet_i`
*   **Password / Mot de passe** : `abdy24068`

> ⚠️ **Important :** Si vous utilisez DBeaver, assurez-vous de bien sélectionner `5433` comme port, sinon vous risquez de vous connecter à une autre base de données locale !

---

## 🛑 Arrêter le projet

Pour arrêter proprement les serveurs sans supprimer les données (les devoirs envoyés, les utilisateurs, les examens sont sauvegardés dans des volumes Docker persistants) :
```bash
docker compose stop
```

Pour tout détruire (y compris les volumes de données PostgreSQL, ce qui **effacera toute la base de données**) :
```bash
docker compose down -v
```
