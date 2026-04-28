#!/bin/bash
mysql -h rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com -u yinhexingchen -p'Yhx@123456' yinhexingchen --ssl-mode=REQUIRED -e "SELECT id, no, customer, project_name, contact, contact_phone FROM delivery_notes WHERE (project_name IS NOT NULL AND project_name != '' AND project_name != '-') OR (contact IS NOT NULL AND contact != '') LIMIT 50;"
