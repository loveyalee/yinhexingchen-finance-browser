<?php
$host = 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com';
$user = 'yinhexingchen';
$pass = 'Yhx@123456';
$db = 'yinhexingchen';

try {
    $conn = new PDO("mysql:host=$host;dbname=$db;charset=utf8mb4", $user, $pass);
    $conn->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    $stmt = $conn->query("SELECT id, no, customer, project_name, contact, contact_phone FROM delivery_notes WHERE (project_name IS NOT NULL AND project_name != '' AND project_name != '-') OR (contact IS NOT NULL AND contact != '') LIMIT 100");
    
    $results = $stmt->fetchAll(PDO::FETCH_ASSOC);
    
    echo json_encode(['success' => true, 'data' => $results], JSON_PRETTY_PRINT);
} catch(PDOException $e) {
    echo json_encode(['success' => false, 'error' => $e->getMessage()]);
}
