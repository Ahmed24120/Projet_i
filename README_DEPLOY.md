# Guide de Déploiement CI/CD (Zero-Downtime)

Ce projet utilise une stratégie de déploiement **Blue/Green** via Docker Compose et Nginx pour garantir un *zero-downtime* (aucune interruption de service durant les mises à jour). Un pipeline **GitHub Actions** automatise le processus à chaque push sur la branche `main`.

## 1. Prérequis sur le serveur distant (Production)
Avant le premier déploiement, votre serveur doit être configuré :

1. **Installer Docker & Docker Compose**
2. **Cloner le repository** dans le dossier utilisateur :
   ```bash
   cd ~
   git clone <URL_DU_REPO> Projet_i
   ```
3. **Créer le premier fichier d'environnement** :
   Le déploiement automatisé a besoin du `.env`. Allez dans les paramètres GitHub pour le renseigner (voir section 2).

## 2. Configuration des GitHub Secrets
Allez dans votre dépôt GitHub : **Settings > Secrets and variables > Actions** et ajoutez ces secrets ("New repository secret") :

- `SERVER_HOST` : L'adresse IP publique de votre serveur (ex: `198.51.100.4`)
- `SERVER_USERNAME` : Le nom d'utilisateur SSH (ex: `root` ou `ubuntu`)
- `SSH_PRIVATE_KEY` : La clé privée SSH permettant de se connecter au serveur **(sans phrase de passe)**.
- `ENV_FILE` : Collez ici l'intégralité du contenu de votre fichier `.env` de production (mots de passe BDD, tokens, `NEXT_PUBLIC_API_URL=/api`, etc.).

## 3. Mise à jour des variables d'environnement (`ENV_FILE`)
Le pipeline lit le secret `ENV_FILE` sur GitHub et recrée le fichier `.env` sur le serveur **à chaque déploiement**.
- Si vous modifiez une variable d'environnement, mettez simplement à jour le secret `ENV_FILE` sur GitHub, puis relancez un workflow ou faites un commit. Le trafic ne sera basculé vers les nouveaux conteneurs (avec les nouvelles variables) que si ces derniers démarrent correctement.

## 4. Comment fonctionne le Zero-Downtime (Blue/Green) ?
1. Le pipeline GitHub se déclenche et passe les tests (Backend & Frontend).
2. GitHub se connecte en SSH au serveur et lance `scripts/deploy.sh`.
3. Le script détecte la couleur active (`blue` sur le port 3000/3001).
4. Il démarre l'autre couleur (`green` sur le port 3002/3003) en arrière plan.
5. **Healthcheck** : Il tape sur les ports de la nouvelle version (`green`).
   - S'il y a des erreurs (crash Next.js ou Node.js), le script détruit `green` et s'arrête en erreur. Nginx ne change pas et vous n'avez eu aucune coupure. (C'est le **Rollback**).
6. Si tout va bien, le script met à jour Nginx et recharge sa configuration sans couper les connexions existantes.
7. Enfin, le script supprime l'ancienne version (`blue`).

## 5. Comment tester manuellement le Rollback ?
Si vous souhaitez vérifier que le mécanisme vous protège d'un mauvais code en production :
1. Introduisez volontairement une erreur fatale dans `backend/src/server.js` (par exemple : invoquez une variable non définie `const a = b;`).
2. Faites un push sur `main`.
3. Allez dans GitHub Actions : vous verrez le Job "deploy" échouer.
4. Rendez-vous sur votre application en production : **elle sera toujours en ligne**. Le script aura intercepté le crash du nouveau conteneur avant de rediriger le trafic Nginx.
