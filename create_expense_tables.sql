-- 费用报销主表
CREATE TABLE IF NOT EXISTS expense_reimbursements (
  id VARCHAR(64) PRIMARY KEY,
  expense_no VARCHAR(64) NOT NULL UNIQUE,
  title VARCHAR(255) NOT NULL,
  amount DECIMAL(12,2) DEFAULT 0.00,
  category VARCHAR(50) DEFAULT 'general',
  description TEXT,
  receipt_count INT DEFAULT 0,
  status ENUM('pending', 'approved', 'rejected', 'paid') DEFAULT 'pending',
  user_id VARCHAR(64),
  user_name VARCHAR(100),
  approver VARCHAR(100),
  approved_time DATETIME,
  paid_time DATETIME,
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  update_time DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_expense_no (expense_no),
  INDEX idx_user_id (user_id),
  INDEX idx_status (status),
  INDEX idx_create_time (create_time)
);

-- 费用明细表
CREATE TABLE IF NOT EXISTS expense_items (
  id INT AUTO_INCREMENT PRIMARY KEY,
  expense_id VARCHAR(64) NOT NULL,
  date DATE,
  type VARCHAR(50),
  amount DECIMAL(12,2) DEFAULT 0.00,
  description VARCHAR(500),
  receipt_path VARCHAR(500),
  create_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (expense_id) REFERENCES expense_reimbursements(id) ON DELETE CASCADE,
  INDEX idx_expense_id (expense_id)
);
