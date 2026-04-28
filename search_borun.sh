#!/bin/bash
for db in /var/www/yinhexingchen/db/users/user_*.db; do
  result=$(sqlite3 "$db" "SELECT * FROM profile WHERE institution_name LIKE '%borun%' OR institution_name LIKE '%博闰%'" 2>/dev/null)
  if [ -n "$result" ]; then
    echo "=== $db ==="
    echo "$result"
  fi
done
