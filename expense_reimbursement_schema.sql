-- ================================================================
-- 费用报销数据库表结构
-- 银河星辰财务办公智能体
-- MySQL 5.7+ / 8.0+
-- ================================================================

-- 使用数据库
USE `rds_dingding`;

-- ================================================================
-- 1. 费用报销主表
-- ================================================================
CREATE TABLE IF NOT EXISTS `expense_reimbursements` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `expense_no` VARCHAR(32) NOT NULL COMMENT '报销单号，如 BX202604001',
  `user_id` VARCHAR(64) NOT NULL COMMENT '申请人用户ID',
  `user_name` VARCHAR(64) NOT NULL COMMENT '申请人姓名',
  `expense_type` VARCHAR(32) NOT NULL COMMENT '报销类型：差旅费/交通费/餐饮费/办公费/通讯费/招待费/培训费/采购费/其他费用',
  `amount` DECIMAL(12,2) NOT NULL DEFAULT 0.00 COMMENT '报销金额（元）',
  `expense_date` DATE NOT NULL COMMENT '费用发生日期',
  `reason` TEXT NOT NULL COMMENT '费用事由/描述',
  `status` VARCHAR(16) NOT NULL DEFAULT 'draft' COMMENT '状态：draft-草稿/pending-待审批/approved-已通过/rejected-已驳回/paid-已打款',
  `images` JSON COMMENT '附件图片JSON数组 [{url, name, size}]',
  `reject_reason` VARCHAR(256) DEFAULT NULL COMMENT '驳回原因',
  `paid_at` DATETIME DEFAULT NULL COMMENT '实际打款时间',
  `paid_method` VARCHAR(32) DEFAULT NULL COMMENT '打款方式：银行转账/支付宝/微信',
  `paid_account` VARCHAR(64) DEFAULT NULL COMMENT '收款账户',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP COMMENT '更新时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_expense_no` (`expense_no`),
  KEY `idx_user_id` (`user_id`),
  KEY `idx_status` (`status`),
  KEY `idx_expense_date` (`expense_date`),
  KEY `idx_expense_type` (`expense_type`),
  KEY `idx_created_at` (`created_at`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='费用报销主表';

-- ================================================================
-- 2. 报销审批流程表
-- ================================================================
CREATE TABLE IF NOT EXISTS `expense_approvals` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `expense_id` BIGINT UNSIGNED NOT NULL COMMENT '报销单ID',
  `approver_id` VARCHAR(64) NOT NULL COMMENT '审批人用户ID',
  `approver_name` VARCHAR(64) NOT NULL COMMENT '审批人姓名',
  `approver_role` VARCHAR(32) DEFAULT NULL COMMENT '审批人角色/职位',
  `approval_level` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '审批级别：1-一级审批/2-二级审批',
  `status` VARCHAR(16) NOT NULL COMMENT '审批状态：approved-通过/rejected-驳回',
  `comment` TEXT DEFAULT NULL COMMENT '审批意见',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '审批时间',
  PRIMARY KEY (`id`),
  KEY `idx_expense_id` (`expense_id`),
  KEY `idx_approver_id` (`approver_id`),
  KEY `idx_status` (`status`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报销审批流程表';

-- ================================================================
-- 3. 附件图片表（可选，用于存储附件元数据）
-- ================================================================
CREATE TABLE IF NOT EXISTS `expense_images` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `expense_id` BIGINT UNSIGNED NOT NULL COMMENT '报销单ID',
  `file_name` VARCHAR(255) NOT NULL COMMENT '文件名',
  `file_url` VARCHAR(512) NOT NULL COMMENT '文件访问URL',
  `file_size` INT UNSIGNED NOT NULL DEFAULT 0 COMMENT '文件大小（字节）',
  `file_type` VARCHAR(32) DEFAULT NULL COMMENT '文件MIME类型',
  `upload_user_id` VARCHAR(64) NOT NULL COMMENT '上传人用户ID',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '上传时间',
  PRIMARY KEY (`id`),
  KEY `idx_expense_id` (`expense_id`),
  KEY `idx_upload_user_id` (`upload_user_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报销附件图片表';

-- ================================================================
-- 4. 报销类型字典表
-- ================================================================
CREATE TABLE IF NOT EXISTS `expense_types` (
  `id` INT UNSIGNED NOT NULL AUTO_INCREMENT COMMENT '主键ID',
  `type_code` VARCHAR(32) NOT NULL COMMENT '类型编码',
  `type_name` VARCHAR(64) NOT NULL COMMENT '类型名称',
  `max_amount` DECIMAL(12,2) DEFAULT NULL COMMENT '单次报销上限（NULL表示无限制）',
  `need_approval` TINYINT NOT NULL DEFAULT 1 COMMENT '是否需要审批：0-不需要/1-需要',
  `approval_level` TINYINT UNSIGNED NOT NULL DEFAULT 1 COMMENT '需要审批级别数',
  `sort_order` INT NOT NULL DEFAULT 0 COMMENT '排序',
  `is_active` TINYINT NOT NULL DEFAULT 1 COMMENT '是否启用：0-禁用/1-启用',
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT '创建时间',
  PRIMARY KEY (`id`),
  UNIQUE KEY `uk_type_code` (`type_code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='报销类型字典表';

-- ================================================================
-- 5. 初始化报销类型数据
-- ================================================================
INSERT INTO `expense_types` (`type_code`, `type_name`, `max_amount`, `need_approval`, `approval_level`, `sort_order`) VALUES
('差旅费', '差旅费', 10000.00, 1, 1, 1),
('交通费', '交通费', 2000.00, 1, 1, 2),
('餐饮费', '餐饮费', 1000.00, 1, 1, 3),
('办公费', '办公费', 5000.00, 1, 1, 4),
('通讯费', '通讯费', 500.00, 0, 0, 5),
('招待费', '招待费', 3000.00, 1, 2, 6),
('培训费', '培训费', 10000.00, 1, 1, 7),
('采购费', '采购费', 50000.00, 1, 2, 8),
('其他费用', '其他费用', 2000.00, 1, 1, 9)
ON DUPLICATE KEY UPDATE `type_name` = VALUES(`type_name`);

-- ================================================================
-- 6. 生成报销单号的存储过程
-- ================================================================
DELIMITER //

DROP PROCEDURE IF EXISTS `gen_expense_no` //

CREATE PROCEDURE `gen_expense_no`(
  OUT out_no VARCHAR(32)
)
BEGIN
  DECLARE v_date VARCHAR(6);
  DECLARE v_seq INT;

  SET v_date = DATE_FORMAT(NOW(), '%Y%m');

  SELECT COALESCE(MAX(CAST(RIGHT(expense_no, 4) AS UNSIGNED)), 0) + 1
  INTO v_seq
  FROM expense_reimbursements
  WHERE LEFT(expense_no, 10) = CONCAT('BX', v_date);

  SET out_no = CONCAT('BX', v_date, LPAD(CAST(v_seq AS CHAR), 4, '0'));
END //

DELIMITER ;

-- ================================================================
-- 7. 测试示例数据
-- ================================================================
-- INSERT INTO `expense_reimbursements` (`expense_no`, `user_id`, `user_name`, `expense_type`, `amount`, `expense_date`, `reason`, `status`)
-- VALUES
-- ('BX202604001', 'USER_001', '张三', '差旅费', 2580.00, '2026-04-15', '上海出差参加财务培训', 'pending'),
-- ('BX202604002', 'USER_001', '张三', '交通费', 320.50, '2026-04-10', '外出办公打车', 'approved'),
-- ('BX202604003', 'USER_001', '张三', '办公费', 890.00, '2026-04-08', '采购办公用品', 'paid');
