ssh root@111.230.36.222 "mysql -u yinhe_user -pyinhe_pass_2024 yinhe_db -e 'SELECT id, name, is_demo, demo_expires_at, created_at FROM companies ORDER BY created_at DESC LIMIT 20;'" 2>&1
