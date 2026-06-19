#!/bin/bash
# Exporter les bases de données (hors système) du conteneur en cours d'exécution
DBS=$(mysql --socket=/run/mysqld/mysqld.sock -u root -B -N -e "SHOW DATABASES;" | grep -E -v '^(mysql|information_schema|performance_schema|sys)$')
if [ -n "$DBS" ]; then
  mysqldump --socket=/run/mysqld/mysqld.sock -u root --databases $DBS > /workspace/db_dump_export.sql 2>/dev/null
fi
