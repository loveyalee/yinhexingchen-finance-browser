#!/usr/bin/env python3
import subprocess

cmd = [
    'mysql',
    '-h', '127.0.0.1',
    '-P', '3306',
    '-u', 'root',
    '-pYhx@123456',
    'yinhexingchen',
    '-e', """
    SELECT id, no, customer, project_name, contact, contact_phone 
    FROM delivery_notes 
    WHERE (project_name IS NOT NULL AND project_name != '' AND project_name != '-')
       OR (contact IS NOT NULL AND contact != '')
    LIMIT 100;
    """
]

result = subprocess.run(cmd, capture_output=True, text=True)
print(result.stdout)
if result.stderr and 'Warning' not in result.stderr:
    print("STDERR:", result.stderr)
