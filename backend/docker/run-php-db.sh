#!/bin/bash

# A. Démarrage de MariaDB
# Copier les fichiers pré-initialisés vers le tmpfs monté sur /var/lib/mysql
cp -rp /var/lib/mysql-template/* /var/lib/mysql/

# Démarrer le démon mysqld
# Sécurité critique : secure_file_priv=/dev/null bloque LOAD_FILE() et INTO OUTFILE
mysqld --no-defaults --user=sandbox --datadir=/var/lib/mysql --socket=/run/mysqld/mysqld.sock --skip-networking --skip-grant-tables --secure-file-priv=/dev/null >/dev/null 2>&1 &

# Attendre que MariaDB soit prêt (polling actif)
for i in {1..30}; do
  if mysqladmin --socket=/run/mysqld/mysqld.sock ping >/dev/null 2>&1; then
    break
  fi
  sleep 0.1
done

# Créer la base par défaut pour les étudiants
mysql --socket=/run/mysqld/mysqld.sock -u root -e "CREATE DATABASE IF NOT EXISTS users_db;" >/dev/null 2>&1

# B. Restauration de l'état précédent (si import disponible)
if [ -f /workspace/db_dump_import.sql ]; then
  mysql --socket=/run/mysqld/mysqld.sock -u root < /workspace/db_dump_import.sql >/dev/null 2>&1 || echo "Warning: database import failed" >&2
fi

# C. Exécution du script PHP de l'étudiant
PHP_FILE=$1
if [ -f /workspace/input.txt ]; then
  timeout 20 php "$PHP_FILE" < /workspace/input.txt
else
  timeout 20 php "$PHP_FILE"
fi
PHP_EXIT=$?

if [ $PHP_EXIT -eq 124 ]; then
  echo "Timeout: Le script PHP a dépassé la limite d'exécution de 20 secondes." >&2
fi

# D. Exportation et persistance après exécution
DBS=$(mysql --socket=/run/mysqld/mysqld.sock -u root -B -N -e "SHOW DATABASES;" | grep -E -v '^(mysql|information_schema|performance_schema|sys)$')

if [ -n "$DBS" ]; then
  mysqldump --socket=/run/mysqld/mysqld.sock -u root --databases $DBS > /workspace/db_dump_export.sql 2>/dev/null
fi

exit $PHP_EXIT
