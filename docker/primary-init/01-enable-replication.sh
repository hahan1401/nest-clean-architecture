#!/bin/bash
# Runs once, on a fresh PGDATA, via /docker-entrypoint-initdb.d.
#
# POSTGRES_HOST_AUTH_METHOD=trust only emits `host all all all trust`, which does not
# cover replication connections — those need their own pg_hba entry.
set -e

echo "host replication all all trust" >> "$PGDATA/pg_hba.conf"
