-- ============================================================
-- 金蝶云星空会计凭证管理模块 - 数据库表结构
-- 版本: V1.0
-- 创建日期: 2024-01-15
-- 数据库: SQL Server 2016+
-- ============================================================

-- 创建模块专用Schema
IF NOT EXISTS (SELECT * FROM sys.schemas WHERE name = 'VOUCHER')
BEGIN
    EXEC('CREATE SCHEMA VOUCHER')
END
GO

-- ============================================================
-- 1. 凭证主表 T_VOUCHER
-- ============================================================
IF OBJECT_ID('VOUCHER.T_VOUCHER', 'U') IS NOT NULL
    DROP TABLE VOUCHER.T_VOUCHER
GO

CREATE TABLE VOUCHER.T_VOUCHER
(
    -- 主键
    FID BIGINT IDENTITY(1,1) NOT NULL,
    
    -- 基础信息
    FVOUCHERNO NVARCHAR(20) NOT NULL,                    -- 凭证号
    FVOUCHERTYPEID BIGINT NOT NULL,                      -- 凭证类型ID
    FVOUCHERTYPENAME NVARCHAR(50),                       -- 凭证类型名称
    FVOUCHERDATE DATE NOT NULL,                          -- 凭证日期
    FACCOUNTINGPERIOD NVARCHAR(10) NOT NULL,             -- 会计期间(YYYY-MM)
    FPERIODYEAR INT NOT NULL,                            -- 会计年度
    FPERIODNUMBER INT NOT NULL,                          -- 期间号(1-12)
    FATTACHMENTCOUNT INT DEFAULT 0,                      -- 附件数
    
    -- 金额汇总
    FDEBITAMOUNT DECIMAL(18,2) DEFAULT 0,                -- 借方合计
    FCREDITAMOUNT DECIMAL(18,2) DEFAULT 0,               -- 贷方合计
    FDIFFAMOUNT DECIMAL(18,2) DEFAULT 0,                 -- 差额
    
    -- 状态字段
    FBILLSTATUS NVARCHAR(10) DEFAULT 'A',                -- 单据状态
    FDOCUMENTSTATUS NVARCHAR(10) DEFAULT 'A',            -- 业务状态
    FPOSTINGSTATUS NVARCHAR(10) DEFAULT 'A',             -- 记账状态
    FISPOSTED BIT DEFAULT 0,                             -- 已过账
    FPOSTINGDATE DATETIME,                               -- 记账日期
    FPOSTERID BIGINT,                                    -- 记账人ID
    
    -- 制单信息
    FCREATORID BIGINT NOT NULL,                          -- 制单人ID
    FCREATORNAME NVARCHAR(50),                           -- 制单人名称
    FCREATEDATE DATETIME DEFAULT GETDATE(),              -- 制单日期
    FMODIFIERID BIGINT,                                  -- 修改人ID
    FMODIFYDATE DATETIME,                                -- 修改日期
    
    -- 审核信息
    FAPPROVERID BIGINT,                                  -- 审核人ID
    FAPPROVERNAME NVARCHAR(50),                          -- 审核人名称
    FAPPROVEDATE DATETIME,                               -- 审核日期
    FAPPROVEREMARK NVARCHAR(500),                        -- 审核意见
    
    -- 现金流量
    FCASHFLOWSTATUS NVARCHAR(10) DEFAULT 'A',            -- 现金流量状态
    FISCASHFLOWREQUIRED BIT DEFAULT 0,                   -- 需指定流量
    
    -- 来源信息
    FSOURCEBILLTYPE NVARCHAR(50),                        -- 源单类型
    FSOURCEBILLNO NVARCHAR(50),                          -- 源单编号
    FBUSINESSTYPE NVARCHAR(50),                          -- 业务类型
    
    -- 作废信息
    FCANCELSTATUS NVARCHAR(10) DEFAULT 'A',              -- 作废状态
    FCANCELDATE DATETIME,                                -- 作废日期
    FCANCELERID BIGINT,                                  -- 作废人ID
    
    -- 扩展字段
    FREMARK NVARCHAR(500),                               -- 备注
    
    -- 组织字段(多组织支持)
    FORGID BIGINT,                                       -- 组织ID
    FDEPTID BIGINT,                                      -- 部门ID
    
    -- 系统字段
    FCREATETIME DATETIME DEFAULT GETDATE(),              -- 创建时间
    FUPDATETIME DATETIME DEFAULT GETDATE(),              -- 更新时间
    
    -- 主键约束
    CONSTRAINT PK_T_VOUCHER PRIMARY KEY CLUSTERED (FID)
)
GO

-- 创建索引
CREATE UNIQUE INDEX IX_T_VOUCHER_NO ON VOUCHER.T_VOUCHER(FVOUCHERNO, FORGID)
CREATE INDEX IX_T_VOUCHER_DATE ON VOUCHER.T_VOUCHER(FVOUCHERDATE)
CREATE INDEX IX_T_VOUCHER_PERIOD ON VOUCHER.T_VOUCHER(FACCOUNTINGPERIOD)
CREATE INDEX IX_T_VOUCHER_STATUS ON VOUCHER.T_VOUCHER(FDOCUMENTSTATUS)
CREATE INDEX IX_T_VOUCHER_POSTED ON VOUCHER.T_VOUCHER(FISPOSTED)
CREATE INDEX IX_T_VOUCHER_CREATOR ON VOUCHER.T_VOUCHER(FCREATORID)
CREATE INDEX IX_T_VOUCHER_ORG ON VOUCHER.T_VOUCHER(FORGID)
GO

-- ============================================================
-- 2. 凭证明细表 T_VOUCHERENTRY
-- ============================================================
IF OBJECT_ID('VOUCHER.T_VOUCHERENTRY', 'U') IS NOT NULL
    DROP TABLE VOUCHER.T_VOUCHERENTRY
GO

CREATE TABLE VOUCHER.T_VOUCHERENTRY
(
    -- 主键
    FENTRYID BIGINT IDENTITY(1,1) NOT NULL,              -- 分录内码
    
    -- 外键
    FID BIGINT NOT NULL,                                 -- 凭证内码
    
    -- 基础信息
    FENTRYSEQ INT NOT NULL,                              -- 分录序号
    
    -- 摘要信息
    FSUMMARY NVARCHAR(255) NOT NULL,                     -- 摘要
    FSUMMARYCODE NVARCHAR(50),                           -- 摘要编码
    FISSAMESUMMARY BIT DEFAULT 0,                        -- 同上摘要
    
    -- 科目信息
    FACCOUNTID BIGINT NOT NULL,                          -- 科目ID
    FACCOUNTNUMBER NVARCHAR(40),                         -- 科目编码
    FACCOUNTNAME NVARCHAR(100),                          -- 科目名称
    FACCOUNTFULLNAME NVARCHAR(200),                      -- 科目全名
    FACCOUNTDIRECTION NVARCHAR(10),                      -- 科目方向
    FISDETAILACCOUNT BIT DEFAULT 1,                      -- 明细科目
    
    -- 金额信息
    FDEBITAMOUNT DECIMAL(18,2) DEFAULT 0,                -- 借方金额
    FCREDITAMOUNT DECIMAL(18,2) DEFAULT 0,               -- 贷方金额
    FAMOUNT DECIMAL(18,2) DEFAULT 0,                     -- 金额(绝对值)
    FCURRENCYID BIGINT,                                  -- 币别ID
    FCURRENCYNAME NVARCHAR(50),                          -- 币别名称
    FEXCHANGERATE DECIMAL(18,6) DEFAULT 1,               -- 汇率
    FFOREIGNAMOUNT DECIMAL(18,2) DEFAULT 0,              -- 外币金额
    
    -- 辅助核算
    FCUSTOMERID BIGINT,                                  -- 客户ID
    FCUSTOMERNAME NVARCHAR(100),                         -- 客户名称
    FSUPPLIERID BIGINT,                                  -- 供应商ID
    FSUPPLIERNAME NVARCHAR(100),                         -- 供应商名称
    FDEPTID BIGINT,                                      -- 部门ID
    FDEPTNAME NVARCHAR(100),                             -- 部门名称
    FEMPLOYEEID BIGINT,                                  -- 职员ID
    FEMPLOYEENAME NVARCHAR(100),                         -- 职员名称
    FPROJECTID BIGINT,                                   -- 项目ID
    FPROJECTNAME NVARCHAR(100),                          -- 项目名称
    FMATERIALID BIGINT,                                  -- 物料ID
    FMATERIALNAME NVARCHAR(100),                         -- 物料名称
    
    -- 现金流量
    FCASHFLOWITEMID BIGINT,                              -- 现金流量项目ID
    FCASHFLOWITEMNAME NVARCHAR(100),                     -- 流量项目名称
    FCASHFLOWDIRECTION NVARCHAR(10),                     -- 流量方向
    FCASHFLOWAMOUNT DECIMAL(18,2) DEFAULT 0,             -- 流量金额
    
    -- 数量金额
    FQUANTITY DECIMAL(18,4) DEFAULT 0,                   -- 数量
    FUNITID BIGINT,                                      -- 计量单位ID
    FUNITNAME NVARCHAR(50),                              -- 单位名称
    FPRICE DECIMAL(18,6) DEFAULT 0,                      -- 单价
    
    -- 来源信息
    FSOURCEBILLTYPE NVARCHAR(50),                        -- 源单类型
    FSOURCEBILLNO NVARCHAR(50),                          -- 源单编号
    FSOURCEENTRYSEQ INT,                                 -- 源单行号
    
    -- 扩展字段
    FREMARK NVARCHAR(500),                               -- 备注
    
    -- 主键约束
    CONSTRAINT PK_T_VOUCHERENTRY PRIMARY KEY CLUSTERED (FENTRYID)
)
GO

-- 创建索引
CREATE INDEX IX_T_VOUCHERENTRY_FID ON VOUCHER.T_VOUCHERENTRY(FID)
CREATE INDEX IX_T_VOUCHERENTRY_ACCOUNT ON VOUCHER.T_VOUCHERENTRY(FACCOUNTID)
CREATE INDEX IX_T_VOUCHERENTRY_CUSTOMER ON VOUCHER.T_VOUCHERENTRY(FCUSTOMERID)
CREATE INDEX IX_T_VOUCHERENTRY_SUPPLIER ON VOUCHER.T_VOUCHERENTRY(FSUPPLIERID)
CREATE INDEX IX_T_VOUCHERENTRY_DEPT ON VOUCHER.T_VOUCHERENTRY(FDEPTID)
CREATE INDEX IX_T_VOUCHERENTRY_EMP ON VOUCHER.T_VOUCHERENTRY(FEMPLOYEEID)
CREATE INDEX IX_T_VOUCHERENTRY_PROJECT ON VOUCHER.T_VOUCHERENTRY(FPROJECTID)
CREATE INDEX IX_T_VOUCHERENTRY_CASHFLOW ON VOUCHER.T_VOUCHERENTRY(FCASHFLOWITEMID)
GO

-- 创建外键约束
ALTER TABLE VOUCHER.T_VOUCHERENTRY
ADD CONSTRAINT FK_T_VOUCHERENTRY_VOUCHER 
FOREIGN KEY (FID) REFERENCES VOUCHER.T_VOUCHER(FID)
ON DELETE CASCADE
GO

-- ============================================================
-- 3. 凭证类型基础资料表 T_VOUCHERTYPE
-- ============================================================
IF OBJECT_ID('VOUCHER.T_VOUCHERTYPE', 'U') IS NOT NULL
    DROP TABLE VOUCHER.T_VOUCHERTYPE
GO

CREATE TABLE VOUCHER.T_VOUCHERTYPE
(
    FTYPEID BIGINT IDENTITY(1,1) NOT NULL,               -- 类型内码
    FTYPENUMBER NVARCHAR(20) NOT NULL,                   -- 类型编码
    FTYPENAME NVARCHAR(50) NOT NULL,                     -- 类型名称
    FPREFIX NVARCHAR(10),                                -- 凭证前缀
    FDIRECTION NVARCHAR(10) DEFAULT 'BOTH',              -- 方向限制
    FISDEFAULT BIT DEFAULT 0,                            -- 是否默认
    FFORBIDSTATUS NVARCHAR(10) DEFAULT 'A',              -- 禁用状态
    FFORBIDDATE DATETIME,                                -- 禁用日期
    FCREATORID BIGINT,                                   -- 创建人
    FCREATEDATE DATETIME DEFAULT GETDATE(),              -- 创建日期
    FMODIFIERID BIGINT,                                  -- 修改人
    FMODIFYDATE DATETIME,                                -- 修改日期
    FREMARK NVARCHAR(500),                               -- 备注
    
    CONSTRAINT PK_T_VOUCHERTYPE PRIMARY KEY CLUSTERED (FTYPEID)
)
GO

-- 创建索引
CREATE UNIQUE INDEX IX_T_VOUCHERTYPE_NUMBER ON VOUCHER.T_VOUCHERTYPE(FTYPENUMBER)
GO

-- 插入默认凭证类型数据
INSERT INTO VOUCHER.T_VOUCHERTYPE (FTYPENUMBER, FTYPENAME, FPREFIX, FDIRECTION, FISDEFAULT)
VALUES 
    ('01', '记账凭证', '记', 'BOTH', 1),
    ('02', '收款凭证', '收', 'DEBIT', 0),
    ('03', '付款凭证', '付', 'CREDIT', 0),
    ('04', '转账凭证', '转', 'BOTH', 0)
GO

-- ============================================================
-- 4. 常用摘要表 T_SUMMARYTEMPLATE
-- ============================================================
IF OBJECT_ID('VOUCHER.T_SUMMARYTEMPLATE', 'U') IS NOT NULL
    DROP TABLE VOUCHER.T_SUMMARYTEMPLATE
GO

CREATE TABLE VOUCHER.T_SUMMARYTEMPLATE
(
    FTEMPLATEID BIGINT IDENTITY(1,1) NOT NULL,           -- 模板内码
    FTEMPLATENUMBER NVARCHAR(50) NOT NULL,               -- 模板编码
    FTEMPLATENAME NVARCHAR(100) NOT NULL,                -- 模板名称
    FSUMMARY NVARCHAR(255) NOT NULL,                     -- 摘要内容
    FACCOUNTID BIGINT,                                   -- 默认科目
    FFORBIDSTATUS NVARCHAR(10) DEFAULT 'A',              -- 禁用状态
    FCREATORID BIGINT,                                   -- 创建人
    FCREATEDATE DATETIME DEFAULT GETDATE(),              -- 创建日期
    FMODIFIERID BIGINT,                                  -- 修改人
    FMODIFYDATE DATETIME,                                -- 修改日期
    
    CONSTRAINT PK_T_SUMMARYTEMPLATE PRIMARY KEY CLUSTERED (FTEMPLATEID)
)
GO

-- 创建索引
CREATE UNIQUE INDEX IX_T_SUMMARYTEMPLATE_NUMBER ON VOUCHER.T_SUMMARYTEMPLATE(FTEMPLATENUMBER)
GO

-- 插入默认常用摘要
INSERT INTO VOUCHER.T_SUMMARYTEMPLATE (FTEMPLATENUMBER, FTEMPLATENAME, FSUMMARY)
VALUES 
    ('01', '购买办公用品', '购买办公用品'),
    ('02', '支付水电费', '支付水电费'),
    ('03', '销售商品', '销售商品'),
    ('04', '支付工资', '支付工资'),
    ('05', '报销差旅费', '报销差旅费'),
    ('06', '收到货款', '收到货款'),
    ('07', '支付货款', '支付货款'),
    ('08', '计提折旧', '计提折旧'),
    ('09', '结转成本', '结转成本'),
    ('10', '结转损益', '结转损益')
GO

-- ============================================================
-- 5. 凭证模板表 T_VOUCHERTEMPLATE
-- ============================================================
IF OBJECT_ID('VOUCHER.T_VOUCHERTEMPLATE', 'U') IS NOT NULL
    DROP TABLE VOUCHER.T_VOUCHERTEMPLATE
GO

CREATE TABLE VOUCHER.T_VOUCHERTEMPLATE
(
    FTEMPLATEID BIGINT IDENTITY(1,1) NOT NULL,           -- 模板内码
    FTEMPLATENUMBER NVARCHAR(50) NOT NULL,               -- 模板编码
    FTEMPLATENAME NVARCHAR(100) NOT NULL,                -- 模板名称
    FVOUCHERTYPEID BIGINT,                               -- 凭证类型
    FFORBIDSTATUS NVARCHAR(10) DEFAULT 'A',              -- 禁用状态
    FCREATORID BIGINT,                                   -- 创建人
    FCREATEDATE DATETIME DEFAULT GETDATE(),              -- 创建日期
    FMODIFIERID BIGINT,                                  -- 修改人
    FMODIFYDATE DATETIME,                                -- 修改日期
    FREMARK NVARCHAR(500),                               -- 备注
    
    CONSTRAINT PK_T_VOUCHERTEMPLATE PRIMARY KEY CLUSTERED (FTEMPLATEID)
)
GO

-- 创建索引
CREATE UNIQUE INDEX IX_T_VOUCHERTEMPLATE_NUMBER ON VOUCHER.T_VOUCHERTEMPLATE(FTEMPLATENUMBER)
GO

-- ============================================================
-- 6. 凭证模板明细表 T_VOUCHERTEMPLATEENTRY
-- ============================================================
IF OBJECT_ID('VOUCHER.T_VOUCHERTEMPLATEENTRY', 'U') IS NOT NULL
    DROP TABLE VOUCHER.T_VOUCHERTEMPLATEENTRY
GO

CREATE TABLE VOUCHER.T_VOUCHERTEMPLATEENTRY
(
    FENTRYID BIGINT IDENTITY(1,1) NOT NULL,              -- 分录内码
    FTEMPLATEID BIGINT NOT NULL,                         -- 模板内码
    FENTRYSEQ INT NOT NULL,                              -- 分录序号
    FSUMMARY NVARCHAR(255),                              -- 摘要
    FACCOUNTID BIGINT,                                   -- 科目ID
    FDEBITAMOUNT DECIMAL(18,2) DEFAULT 0,                -- 借方金额
    FCREDITAMOUNT DECIMAL(18,2) DEFAULT 0,               -- 贷方金额
    FCUSTOMERID BIGINT,                                  -- 客户ID
    FSUPPLIERID BIGINT,                                  -- 供应商ID
    FDEPTID BIGINT,                                      -- 部门ID
    FEMPLOYEEID BIGINT,                                  -- 职员ID
    FPROJECTID BIGINT,                                   -- 项目ID
    FCASHFLOWITEMID BIGINT,                              -- 现金流量项目ID
    
    CONSTRAINT PK_T_VOUCHERTEMPLATEENTRY PRIMARY KEY CLUSTERED (FENTRYID)
)
GO

-- 创建外键
ALTER TABLE VOUCHER.T_VOUCHERTEMPLATEENTRY
ADD CONSTRAINT FK_T_VOUCHERTEMPLATEENTRY_TEMPLATE 
FOREIGN KEY (FTEMPLATEID) REFERENCES VOUCHER.T_VOUCHERTEMPLATE(FTEMPLATEID)
ON DELETE CASCADE
GO

-- ============================================================
-- 7. 凭证操作日志表 T_VOUCHERLOG
-- ============================================================
IF OBJECT_ID('VOUCHER.T_VOUCHERLOG', 'U') IS NOT NULL
    DROP TABLE VOUCHER.T_VOUCHERLOG
GO

CREATE TABLE VOUCHER.T_VOUCHERLOG
(
    FLOGID BIGINT IDENTITY(1,1) NOT NULL,                -- 日志内码
    FID BIGINT NOT NULL,                                 -- 凭证内码
    FVOUCHERNO NVARCHAR(20),                             -- 凭证号
    FOPERATIONTYPE NVARCHAR(50) NOT NULL,                -- 操作类型
    FOPERATIONNAME NVARCHAR(100),                        -- 操作名称
    FOPERATORID BIGINT,                                  -- 操作人ID
    FOPERATORNAME NVARCHAR(50),                          -- 操作人名称
    FOPERATIONTIME DATETIME DEFAULT GETDATE(),           -- 操作时间
    FOPERATIONRESULT NVARCHAR(10),                       -- 操作结果
    FOPERATIONDETAIL NVARCHAR(MAX),                      -- 操作详情
    FIPADDRESS NVARCHAR(50),                             -- IP地址
    
    CONSTRAINT PK_T_VOUCHERLOG PRIMARY KEY CLUSTERED (FLOGID)
)
GO

-- 创建索引
CREATE INDEX IX_T_VOUCHERLOG_VOUCHER ON VOUCHER.T_VOUCHERLOG(FID)
CREATE INDEX IX_T_VOUCHERLOG_TIME ON VOUCHER.T_VOUCHERLOG(FOPERATIONTIME)
CREATE INDEX IX_T_VOUCHERLOG_OPERATOR ON VOUCHER.T_VOUCHERLOG(FOPERATORID)
GO

-- ============================================================
-- 8. 凭证红冲关系表 T_VOUCHERREDCANCEL
-- ============================================================
IF OBJECT_ID('VOUCHER.T_VOUCHERREDCANCEL', 'U') IS NOT NULL
    DROP TABLE VOUCHER.T_VOUCHERREDCANCEL
GO

CREATE TABLE VOUCHER.T_VOUCHERREDCANCEL
(
    FRELATIONID BIGINT IDENTITY(1,1) NOT NULL,           -- 关系内码
    FORIGINALVOUCHERID BIGINT NOT NULL,                  -- 原凭证ID
    FORIGINALVOUCHERNO NVARCHAR(20),                     -- 原凭证号
    FREDVOUCHERID BIGINT NOT NULL,                       -- 红字凭证ID
    FREDVOUCHERNO NVARCHAR(20),                          -- 红字凭证号
    FCORRECTVOUCHERID BIGINT,                            -- 更正凭证ID
    FCORRECTVOUCHERNO NVARCHAR(20),                      -- 更正凭证号
    FCREATEDATE DATETIME DEFAULT GETDATE(),              -- 创建日期
    FCREATORID BIGINT,                                   -- 创建人
    
    CONSTRAINT PK_T_VOUCHERREDCANCEL PRIMARY KEY CLUSTERED (FRELATIONID)
)
GO

-- 创建索引
CREATE INDEX IX_T_VOUCHERREDCANCEL_ORIGINAL ON VOUCHER.T_VOUCHERREDCANCEL(FORIGINALVOUCHERID)
CREATE INDEX IX_T_VOUCHERREDCANCEL_RED ON VOUCHER.T_VOUCHERREDCANCEL(FREDVOUCHERID)
GO

-- ============================================================
-- 9. 创建视图
-- ============================================================

-- 9.1 凭证完整信息视图
IF OBJECT_ID('VOUCHER.V_VOUCHER_FULL', 'V') IS NOT NULL
    DROP VIEW VOUCHER.V_VOUCHER_FULL
GO

CREATE VIEW VOUCHER.V_VOUCHER_FULL
AS
SELECT 
    v.*,
    e.FENTRYID,
    e.FENTRYSEQ,
    e.FSUMMARY,
    e.FACCOUNTID,
    e.FACCOUNTNUMBER,
    e.FACCOUNTNAME,
    e.FACCOUNTFULLNAME,
    e.FDEBITAMOUNT AS FENTRYDEBIT,
    e.FCREDITAMOUNT AS FENTRYCREDIT,
    e.FCUSTOMERID,
    e.FCUSTOMERNAME,
    e.FSUPPLIERID,
    e.FSUPPLIERNAME,
    e.FDEPTID AS FENTRYDEPTID,
    e.FDEPTNAME AS FENTRYDEPTNAME,
    e.FEMPLOYEEID,
    e.FEMPLOYEENAME,
    e.FPROJECTID,
    e.FPROJECTNAME,
    e.FCASHFLOWITEMID,
    e.FCASHFLOWITEMNAME
FROM VOUCHER.T_VOUCHER v
LEFT JOIN VOUCHER.T_VOUCHERENTRY e ON v.FID = e.FID
GO

-- 9.2 凭证汇总视图
IF OBJECT_ID('VOUCHER.V_VOUCHER_SUMMARY', 'V') IS NOT NULL
    DROP VIEW VOUCHER.V_VOUCHER_SUMMARY
GO

CREATE VIEW VOUCHER.V_VOUCHER_SUMMARY
AS
SELECT 
    v.FID,
    v.FVOUCHERNO,
    v.FVOUCHERTYPENAME,
    v.FVOUCHERDATE,
    v.FACCOUNTINGPERIOD,
    v.FDEBITAMOUNT,
    v.FCREDITAMOUNT,
    v.FDOCUMENTSTATUS,
    v.FISPOSTED,
    v.FCREATORNAME,
    v.FCREATEDATE,
    v.FAPPROVERNAME,
    v.FAPPROVEDATE,
    COUNT(e.FENTRYID) AS FENTRYCOUNT
FROM VOUCHER.T_VOUCHER v
LEFT JOIN VOUCHER.T_VOUCHERENTRY e ON v.FID = e.FID
GROUP BY 
    v.FID, v.FVOUCHERNO, v.FVOUCHERTYPENAME, v.FVOUCHERDATE,
    v.FACCOUNTINGPERIOD, v.FDEBITAMOUNT, v.FCREDITAMOUNT,
    v.FDOCUMENTSTATUS, v.FISPOSTED, v.FCREATORNAME, v.FCREATEDATE,
    v.FAPPROVERNAME, v.FAPPROVEDATE
GO

-- ============================================================
-- 10. 创建存储过程
-- ============================================================

-- 10.1 生成凭证号存储过程
IF OBJECT_ID('VOUCHER.SP_GENERATEVOUCHERNO', 'P') IS NOT NULL
    DROP PROCEDURE VOUCHER.SP_GENERATEVOUCHERNO
GO

CREATE PROCEDURE VOUCHER.SP_GENERATEVOUCHERNO
    @VoucherTypeID BIGINT,
    @VoucherDate DATE,
    @OrgID BIGINT,
    @VoucherNo NVARCHAR(20) OUTPUT
AS
BEGIN
    DECLARE @Year INT = YEAR(@VoucherDate)
    DECLARE @Month INT = MONTH(@VoucherDate)
    DECLARE @Prefix NVARCHAR(10)
    DECLARE @MaxNo INT
    
    -- 获取凭证类型前缀
    SELECT @Prefix = FPREFIX FROM VOUCHER.T_VOUCHERTYPE WHERE FTYPEID = @VoucherTypeID
    
    -- 获取当前最大凭证号
    SELECT @MaxNo = ISNULL(MAX(CAST(SUBSTRING(FVOUCHERNO, LEN(@Prefix) + 9, 4) AS INT)), 0)
    FROM VOUCHER.T_VOUCHER
    WHERE FVOUCHERTYPEID = @VoucherTypeID
      AND FPERIODYEAR = @Year
      AND FPERIODNUMBER = @Month
      AND FORGID = @OrgID
    
    -- 生成新凭证号
    SET @VoucherNo = @Prefix + '-' + CAST(@Year AS NVARCHAR(4)) + RIGHT('00' + CAST(@Month AS NVARCHAR(2)), 2) + '-' + RIGHT('0000' + CAST(@MaxNo + 1 AS NVARCHAR(4)), 4)
END
GO

-- 10.2 检查借贷平衡存储过程
IF OBJECT_ID('VOUCHER.SP_CHECKBALANCE', 'P') IS NOT NULL
    DROP PROCEDURE VOUCHER.SP_CHECKBALANCE
GO

CREATE PROCEDURE VOUCHER.SP_CHECKBALANCE
    @VoucherID BIGINT,
    @IsBalanced BIT OUTPUT,
    @Difference DECIMAL(18,2) OUTPUT
AS
BEGIN
    DECLARE @DebitSum DECIMAL(18,2)
    DECLARE @CreditSum DECIMAL(18,2)
    
    SELECT 
        @DebitSum = ISNULL(SUM(FDEBITAMOUNT), 0),
        @CreditSum = ISNULL(SUM(FCREDITAMOUNT), 0)
    FROM VOUCHER.T_VOUCHERENTRY
    WHERE FID = @VoucherID
    
    SET @Difference = @DebitSum - @CreditSum
    
    IF ABS(@Difference) < 0.01
        SET @IsBalanced = 1
    ELSE
        SET @IsBalanced = 0
END
GO

-- 10.3 记账存储过程
IF OBJECT_ID('VOUCHER.SP_POSTVOUCHER', 'P') IS NOT NULL
    DROP PROCEDURE VOUCHER.SP_POSTVOUCHER
GO

CREATE PROCEDURE VOUCHER.SP_POSTVOUCHER
    @VoucherID BIGINT,
    @PosterID BIGINT,
    @Result NVARCHAR(10) OUTPUT,
    @Message NVARCHAR(500) OUTPUT
AS
BEGIN
    BEGIN TRANSACTION
    
    BEGIN TRY
        -- 检查凭证状态
        IF NOT EXISTS(SELECT 1 FROM VOUCHER.T_VOUCHER WHERE FID = @VoucherID AND FDOCUMENTSTATUS = 'C')
        BEGIN
            SET @Result = 'ERROR'
            SET @Message = '凭证未审核，不能记账'
            ROLLBACK TRANSACTION
            RETURN
        END
        
        -- 检查是否已记账
        IF EXISTS(SELECT 1 FROM VOUCHER.T_VOUCHER WHERE FID = @VoucherID AND FISPOSTED = 1)
        BEGIN
            SET @Result = 'ERROR'
            SET @Message = '凭证已记账，不能重复记账'
            ROLLBACK TRANSACTION
            RETURN
        END
        
        -- 更新凭证状态
        UPDATE VOUCHER.T_VOUCHER
        SET FISPOSTED = 1,
            FPOSTINGSTATUS = 'B',
            FDOCUMENTSTATUS = 'D',
            FPOSTINGDATE = GETDATE(),
            FPOSTERID = @PosterID
        WHERE FID = @VoucherID
        
        -- 记录日志
        INSERT INTO VOUCHER.T_VOUCHERLOG (FID, FVOUCHERNO, FOPERATIONTYPE, FOPERATIONNAME, 
            FOPERATORID, FOPERATIONRESULT, FOPERATIONDETAIL)
        SELECT FID, FVOUCHERNO, 'POST', '记账', @PosterID, 'SUCCESS', '凭证记账成功'
        FROM VOUCHER.T_VOUCHER WHERE FID = @VoucherID
        
        SET @Result = 'SUCCESS'
        SET @Message = '记账成功'
        
        COMMIT TRANSACTION
    END TRY
    BEGIN CATCH
        ROLLBACK TRANSACTION
        SET @Result = 'ERROR'
        SET @Message = ERROR_MESSAGE()
    END CATCH
END
GO

-- ============================================================
-- 11. 创建触发器
-- ============================================================

-- 11.1 凭证更新触发器
IF OBJECT_ID('VOUCHER.TR_VOUCHER_UPDATE', 'TR') IS NOT NULL
    DROP TRIGGER VOUCHER.TR_VOUCHER_UPDATE
GO

CREATE TRIGGER VOUCHER.TR_VOUCHER_UPDATE
ON VOUCHER.T_VOUCHER
AFTER UPDATE
AS
BEGIN
    UPDATE VOUCHER.T_VOUCHER
    SET FUPDATETIME = GETDATE()
    WHERE FID IN (SELECT FID FROM inserted)
END
GO

-- 11.2 凭证明细更新触发器 - 自动更新主表金额
IF OBJECT_ID('VOUCHER.TR_VOUCHERENTRY_UPDATE', 'TR') IS NOT NULL
    DROP TRIGGER VOUCHER.TR_VOUCHERENTRY_UPDATE
GO

CREATE TRIGGER VOUCHER.TR_VOUCHERENTRY_UPDATE
ON VOUCHER.T_VOUCHERENTRY
AFTER INSERT, UPDATE, DELETE
AS
BEGIN
    DECLARE @VoucherID BIGINT
    
    -- 获取受影响的凭证ID
    SELECT @VoucherID = FID FROM inserted
    UNION
    SELECT FID FROM deleted
    
    -- 更新主表金额
    UPDATE v
    SET FDEBITAMOUNT = ISNULL(e.FDEBITSUM, 0),
        FCREDITAMOUNT = ISNULL(e.FCREDITSUM, 0),
        FDIFFAMOUNT = ISNULL(e.FDEBITSUM, 0) - ISNULL(e.FCREDITSUM, 0)
    FROM VOUCHER.T_VOUCHER v
    LEFT JOIN (
        SELECT FID, 
               SUM(FDEBITAMOUNT) AS FDEBITSUM,
               SUM(FCREDITAMOUNT) AS FCREDITSUM
        FROM VOUCHER.T_VOUCHERENTRY
        WHERE FID = @VoucherID
        GROUP BY FID
    ) e ON v.FID = e.FID
    WHERE v.FID = @VoucherID
END
GO

PRINT '金蝶云星空会计凭证管理模块数据库结构创建完成！'
GO
