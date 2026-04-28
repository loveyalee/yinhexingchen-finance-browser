#!/usr/bin/env python3
import subprocess

# 直接用本地mysql客户端
result = subprocess.run(
    ['mysql', '-e', "SELECT id, no, customer, project_name, contact, contact_phone FROM yinhexingchen.delivery_notes WHERE (project_name IS NOT NULL AND project_name != '' AND project_name != '-') OR (contact IS NOT NULL AND contact != '') LIMIT 100;"],
    capture_output=True, text=True
)
print(result.stdout)
print(result.stderr)
