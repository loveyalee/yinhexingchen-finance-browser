#!/usr/bin/env python3
import mysql.connector

conn = mysql.connector.connect(
    host='127.0.0.1',
    user='yinhe_user',
    password='yinhe_pass_2024',
    database='yinhe_db'
)
cursor = conn.cursor()
cursor.execute('SELECT id, name, is_demo, demo_expires_at, created_at FROM companies ORDER BY created_at DESC LIMIT 30')
print('id\tname\tis_demo\tdemo_expires_at\tcreated_at')
for row in cursor.fetchall():
    print('\t'.join(str(x) for x in row))
cursor.close()
conn.close()
