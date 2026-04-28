#!/bin/bash
for db in /var/www/yinhexingchen/db/users/*.db; do
  echo "=== $db ==="
  sqlite3 "$db" "SELECT * FROM users LIMIT 5" 2>/dev/null
done
