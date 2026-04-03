# 金蝶云星空BOS会计凭证管理模块 - 表单设计说明

## 一、模块概述

### 1.1 模块标识
- **模块编码**: VOUCHER_MGR
- **模块名称**: 会计凭证管理
- **所属领域**: 财务会计
- **开发平台**: 金蝶云星空BOS设计器

### 1.2 业务对象清单

| 序号 | 业务对象编码 | 业务对象名称 | 类型 | 说明 |
|------|-------------|-------------|------|------|
| 1 | VOUCHER | 记账凭证 | 单据 | 主业务对象 |
| 2 | VOUCHER_ENTRY | 凭证明细 | 单据体 | 明细业务对象 |
| 3 | VOUCHER_TYPE | 凭证类型 | 基础资料 | 凭证类型定义 |
| 4 | SUMMARY_TEMPLATE | 常用摘要 | 基础资料 | 常用摘要模板 |
| 5 | VOUCHER_TEMPLATE | 凭证模板 | 基础资料 | 常用凭证模板 |

---

## 二、凭证主表（VOUCHER）设计

### 2.1 表单基本信息

```xml
<FormMetadata>
  <FormId>VOUCHER</FormId>
  <FormName>记账凭证</FormName>
  <FormType>Bill</FormType>
  <TableName>T_VOUCHER</TableName>
  <EntryTableName>T_VOUCHERENTRY</EntryTableName>
  <PrimaryKey>FID</PrimaryKey>
  <BillTypeField>FVOUCHERTYPEID</BillTypeField>
  <BillNoField>FVOUCHERNO</BillNoField>
  <DateField>FVOUCHERDATE</DateField>
  <CreatorField>FCreatorId</CreatorField>
  <CreateDateField>FCreateDate</CreateDateField>
  <ModifierField>FModifierId</ModifierDate>
  <ModifyDateField>FModifyDate</ModifyDateField>
  <ApproverField>FApproverId</ApproverField>
  <ApproveDateField>FApproveDate</ApproveDateField>
  <DocumentStatusField>FDocumentStatus</DocumentStatusField>
  <BillStatusField>FBillStatus</BillStatusField>
</FormMetadata>
```

### 2.2 主表字段详细设计

#### 2.2.1 基础信息区域

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FID | 内码 | Int64 | - | 是 | 自增 | 主键，系统自动生成 |
| FVOUCHERNO | 凭证号 | String | 20 | 是 | 自动编码 | 按期间+类型自动编号 |
| FVOUCHERTYPEID | 凭证类型 | Int64 | - | 是 | - | 关联凭证类型基础资料 |
| FVOUCHERTYPENAME | 凭证类型名称 | String | 50 | - | - | 显示字段 |
| FVOUCHERDATE | 凭证日期 | DateTime | - | 是 | 当前日期 | 业务发生日期 |
| FACCOUNTINGPERIOD | 会计期间 | String | 10 | 是 | 当前期间 | 格式：YYYY-MM |
| FPERIODYEAR | 会计年度 | Int32 | - | 是 | 当前年度 | - |
| FPERIODNUMBER | 期间号 | Int32 | - | 是 | 当前期间号 | 1-12 |
| FATTACHMENTCOUNT | 附件数 | Int32 | - | 否 | 0 | 附件张数 |

#### 2.2.2 金额汇总区域

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FDEBITAMOUNT | 借方合计 | Decimal | 18,2 | 是 | 0 | 明细借方金额合计 |
| FCREDITAMOUNT | 贷方合计 | Decimal | 18,2 | 是 | 0 | 明细贷方金额合计 |
| FDIFFAMOUNT | 差额 | Decimal | 18,2 | - | 0 | 借贷差额，必须为0 |

#### 2.2.3 状态与流程字段

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FBILLSTATUS | 单据状态 | String | 10 | 是 | "A" | A-创建 B-审核中 C-已审核 D-重新审核 |
| FDOCUMENTSTATUS | 业务状态 | String | 10 | 是 | "A" | A-制单 B-已审核 C-已记账 D-已红冲 |
| FPOSTINGSTATUS | 记账状态 | String | 10 | 是 | "A" | A-未记账 B-已记账 C-反记账 |
| FISPOSTED | 已过账 | Boolean | - | 是 | false | 是否已过账 |
| FPOSTINGDATE | 记账日期 | DateTime | - | 否 | - | 实际记账日期 |
| FPOSTERID | 记账人 | Int64 | - | 否 | - | 关联用户 |

#### 2.2.4 制单信息区域

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FCREATORID | 制单人 | Int64 | - | 是 | 当前用户 | 关联用户 |
| FCREATORNAME | 制单人名称 | String | 50 | - | - | 显示字段 |
| FCREATEDATE | 制单日期 | DateTime | - | 是 | 当前时间 | - |
| FMODIFIERID | 修改人 | Int64 | - | 否 | - | 关联用户 |
| FMODIFYDATE | 修改日期 | DateTime | - | 否 | - | - |

#### 2.2.5 审核信息区域

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FAPPROVERID | 审核人 | Int64 | - | 否 | - | 关联用户 |
| FAPPROVERNAME | 审核人名称 | String | 50 | - | - | 显示字段 |
| FAPPROVEDATE | 审核日期 | DateTime | - | 否 | - | - |
| FAPPROVEREMARK | 审核意见 | String | 500 | 否 | - | 审核备注 |

#### 2.2.6 现金流量区域

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FCASHFLOWSTATUS | 现金流量状态 | String | 10 | 是 | "A" | A-未指定 B-部分指定 C-已指定 |
| FISCASHFLOWREQUIRED | 需指定流量 | Boolean | - | 是 | false | 是否涉及现金流量 |

#### 2.2.7 扩展字段

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FSOURCEBILLTYPE | 源单类型 | String | 50 | 否 | - | 业务系统来源 |
| FSOURCEBILLNO | 源单编号 | String | 50 | 否 | - | 源单编号 |
| FBUSINESSTYPE | 业务类型 | String | 50 | 否 | - | 业务分类 |
| FREMARK | 备注 | String | 500 | 否 | - | 凭证备注 |
| FCANCELSTATUS | 作废状态 | String | 10 | 是 | "A" | A-正常 B-已作废 |
| FCANCELDATE | 作废日期 | DateTime | - | 否 | - | - |
| FCANCELERID | 作废人 | Int64 | - | 否 | - | - |

---

## 三、凭证明细表（VOUCHER_ENTRY）设计

### 3.1 明细表基本信息

```xml
<EntryMetadata>
  <EntryId>VOUCHER_ENTRY</EntryId>
  <EntryName>凭证明细</EntryName>
  <TableName>T_VOUCHERENTRY</TableName>
  <PrimaryKey>FEntryID</PrimaryKey>
  <ForeignKey>FID</ForeignKey>
  <SeqField>FEntrySeq</SeqField>
</EntryMetadata>
```

### 3.2 明细表字段详细设计

#### 3.2.1 基础信息

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FEntryID | 分录内码 | Int64 | - | 是 | 自增 | 主键 |
| FID | 凭证内码 | Int64 | - | 是 | - | 外键关联主表 |
| FEntrySeq | 分录序号 | Int32 | - | 是 | 自动递增 | 行号 |

#### 3.2.2 科目信息

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FACCOUNTID | 科目ID | Int64 | - | 是 | - | F7选择会计科目 |
| FACCOUNTNUMBER | 科目编码 | String | 40 | - | - | 科目编码显示 |
| FACCOUNTNAME | 科目名称 | String | 100 | - | - | 科目名称显示 |
| FACCOUNTFULLNAME | 科目全名 | String | 200 | - | - | 包含上级科目 |
| FACCOUNTDIRECTION | 科目方向 | String | 10 | - | - | 借/贷方向 |
| FISDETAILACCOUNT | 明细科目 | Boolean | - | - | - | 是否最明细科目 |

#### 3.2.3 摘要信息

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FSUMMARY | 摘要 | String | 255 | 是 | - | 业务摘要说明 |
| FSUMMARYCODE | 摘要编码 | String | 50 | 否 | - | 常用摘要编码 |
| FISSAMESUMMARY | 同上 | Boolean | - | 否 | false | 同上摘要标记 |

#### 3.2.4 金额信息

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FDEBITAMOUNT | 借方金额 | Decimal | 18,2 | 否 | 0 | 借方发生额 |
| FCREDITAMOUNT | 贷方金额 | Decimal | 18,2 | 否 | 0 | 贷方发生额 |
| FAMOUNT | 金额 | Decimal | 18,2 | - | 0 | 绝对值金额 |
| FCURRENCYID | 币别ID | Int64 | - | 是 | 本位币 | F7选择币别 |
| FCURRENCYNAME | 币别名称 | String | 50 | - | - | 显示字段 |
| FEXCHANGERATE | 汇率 | Decimal | 18,6 | 是 | 1 | 记账汇率 |
| FFOREIGNAMOUNT | 外币金额 | Decimal | 18,2 | 否 | 0 | 原币金额 |

#### 3.2.5 辅助核算信息

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FCUSTOMERID | 客户 | Int64 | - | 否 | - | F7选择客户 |
| FCUSTOMERNAME | 客户名称 | String | 100 | - | - | 显示字段 |
| FSUPPLIERID | 供应商 | Int64 | - | 否 | - | F7选择供应商 |
| FSUPPLIERNAME | 供应商名称 | String | 100 | - | - | 显示字段 |
| FDEPTID | 部门 | Int64 | - | 否 | - | F7选择部门 |
| FDEPTNAME | 部门名称 | String | 100 | - | - | 显示字段 |
| FEMPLOYEEID | 职员 | Int64 | - | 否 | - | F7选择职员 |
| FEMPLOYEENAME | 职员名称 | String | 100 | - | - | 显示字段 |
| FPROJECTID | 项目 | Int64 | - | 否 | - | F7选择项目 |
| FPROJECTNAME | 项目名称 | String | 100 | - | - | 显示字段 |
| FMATERIALID | 物料 | Int64 | - | 否 | - | F7选择物料 |
| FMATERIALNAME | 物料名称 | String | 100 | - | - | 显示字段 |

#### 3.2.6 现金流量信息

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FCASHFLOWITEMID | 现金流量项目 | Int64 | - | 否 | - | F7选择流量项目 |
| FCASHFLOWITEMNAME | 流量项目名称 | String | 100 | - | - | 显示字段 |
| FCASHFLOWDIRECTION | 流量方向 | String | 10 | - | - | 流入/流出 |
| FCASHFLOWAMOUNT | 流量金额 | Decimal | 18,2 | - | 0 | 指定流量金额 |

#### 3.2.7 数量金额信息

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FQUANTITY | 数量 | Decimal | 18,4 | 否 | 0 | 数量 |
| FUNITID | 计量单位 | Int64 | - | 否 | - | F7选择单位 |
| FUNITNAME | 单位名称 | String | 50 | - | - | 显示字段 |
| FPRICE | 单价 | Decimal | 18,6 | 否 | 0 | 单价 |

#### 3.2.8 扩展信息

| 字段编码 | 字段名称 | 字段类型 | 长度 | 必填 | 默认值 | 说明 |
|---------|---------|---------|------|------|--------|------|
| FSOURCEBILLTYPE | 源单类型 | String | 50 | 否 | - | 业务系统来源 |
| FSOURCEBILLNO | 源单编号 | String | 50 | 否 | - | 源单编号 |
| FSOURCEENTRYSEQ | 源单行号 | Int32 | - | 否 | - | 源单行号 |
| FREMARK | 备注 | String | 500 | 否 | - | 分录备注 |

---

## 四、表单界面布局设计

### 4.1 表单整体布局

```
┌─────────────────────────────────────────────────────────────┐
│  记账凭证                                              [保存][审核][记账]  │
├─────────────────────────────────────────────────────────────┤
│  凭证类型: [记 ▼]  凭证号: [2024-001  ]  凭证日期: [2024-01-15 ▼]      │
│  会计期间: [2024-01    ]  附件数: [2   ]  制单人: [张三          ]      │
├─────────────────────────────────────────────────────────────┤
│  摘要        科目        借方金额        贷方金额        辅助核算       │
│  ─────────────────────────────────────────────────────────  │
│  [摘要    ] [科目F7  ] [借方金额    ] [        ] [辅助核算F7] [增行]    │
│  [同上    ] [科目F7  ] [        ] [贷方金额    ] [辅助核算F7] [删行]    │
│  ...                                                        │
├─────────────────────────────────────────────────────────────┤
│  合计:              借方: [100,000.00]  贷方: [100,000.00]  平衡 ✓      │
├─────────────────────────────────────────────────────────────┤
│  现金流量指定: [指定流量 ▼]                                          │
│  [现金流量项目F7] [流入/流出 ▼] [金额        ]                        │
├─────────────────────────────────────────────────────────────┤
│  制单人: [张三    ]  制单日期: [2024-01-15 10:30:00]                    │
│  审核人: [李四    ]  审核日期: [2024-01-15 11:00:00]                    │
│  记账人: [王五    ]  记账日期: [2024-01-15 14:00:00]                    │
└─────────────────────────────────────────────────────────────┘
```

### 4.2 界面元素详细说明

#### 4.2.1 工具栏按钮

| 按钮编码 | 按钮名称 | 功能说明 | 启用条件 |
|---------|---------|---------|---------|
| TB_SAVE | 保存 | 保存凭证 | 制单状态 |
| TB_SUBMIT | 提交 | 提交审核 | 制单状态且数据完整 |
| TB_AUDIT | 审核 | 审核凭证 | 提交状态且非制单人 |
| TB_UNAUDIT | 反审核 | 取消审核 | 已审核且未记账 |
| TB_POST | 记账 | 记账处理 | 已审核 |
| TB_UNPOST | 反记账 | 取消记账 | 已记账且当期未结账 |
| TB_REDCANCEL | 红冲 | 红字冲销 | 已记账 |
| TB_PRINT | 打印 | 打印凭证 | 任意状态 |
| TB_PREVIEW | 预览 | 打印预览 | 任意状态 |
| TB_EXPORT | 导出 | 导出Excel | 任意状态 |
| TB_ADDROW | 增行 | 增加分录行 | 制单或反审核状态 |
| TB_DELROW | 删行 | 删除分录行 | 制单或反审核状态 |
| TB_COPYROW | 复制行 | 复制分录行 | 有选中行 |
| TB_INSERTROW | 插入行 | 插入分录行 | 有选中行 |

#### 4.2.2 单据体菜单

| 菜单项 | 功能说明 |
|--------|---------|
| 插入行 | 在当前行前插入新行 |
| 删除行 | 删除当前行 |
| 复制行 | 复制当前行到剪贴板 |
| 粘贴行 | 粘贴剪贴板内容 |
| 批量填充摘要 | 将第一行摘要填充到后续行 |
| 平衡借贷 | 自动平衡借贷金额 |

---

## 五、F7选择框配置

### 5.1 会计科目F7

```xml
<FilterParameter>
  <FormId>BD_ACCOUNTS</FormId>
  <FilterString>
    FAccountTableId = @FAccountTableId 
    AND FIsDetail = 1 
    AND FForbidStatus = 'A'
  </FilterString>
  <DisplayField>FNumber,FName,FFullName</DisplayField>
  <ReturnField>FAccountId,FNumber,FName,FFullName,FDirection</ReturnField>
  <SortField>FNumber</SortField>
</FilterParameter>
```

### 5.2 辅助核算F7配置

根据科目属性动态显示对应的辅助核算F7：

| 辅助核算类型 | F7表单ID | 过滤条件 |
|-------------|---------|---------|
| 客户 | BD_CUSTOMER | FForbidStatus = 'A' |
| 供应商 | BD_SUPPLIER | FForbidStatus = 'A' |
| 部门 | BD_DEPARTMENT | FForbidStatus = 'A' |
| 职员 | BD_EMPLOYEE | FForbidStatus = 'A' |
| 项目 | BD_PROJECT | FForbidStatus = 'A' |

### 5.3 现金流量项目F7

```xml
<FilterParameter>
  <FormId>BD_CASHFLOWITEM</FormId>
  <FilterString>FForbidStatus = 'A'</FilterString>
  <DisplayField>FNumber,FName,FDirection</DisplayField>
  <ReturnField>FItemId,FNumber,FName,FDirection</ReturnField>
</FilterParameter>
```

---

## 六、业务规则配置

### 6.1 自动编码规则

```xml
<BillCodeRule>
  <RuleName>凭证号编码规则</RuleName>
  <RuleType>PeriodType</RuleType>
  <ResetPeriod>Month</ResetPeriod>
  <Prefix>{FVOUCHERTYPE}-{FPERIODYEAR}{FPERIODNUMBER:00}-</Prefix>
  <StartNumber>1</StartNumber>
  <Step>1</Step>
  <Length>4</Length>
  <FillChar>0</FillChar>
</BillCodeRule>
```

编码示例：
- 记-202401-0001
- 收-202401-0001
- 付-202401-0001
- 转-202401-0001

### 6.2 必录项规则

| 字段 | 必录条件 | 提示信息 |
|------|---------|---------|
| FVOUCHERDATE | 始终必录 | 凭证日期不能为空 |
| FACCOUNTINGPERIOD | 始终必录 | 会计期间不能为空 |
| FACCOUNTID | 分录必录 | 第{行号}行科目不能为空 |
| FSUMMARY | 分录必录 | 第{行号}行摘要不能为空 |
| FDEBITAMOUNT/FCREDITAMOUNT | 分录必录其一 | 第{行号}行借方或贷方金额必须录入 |

### 6.3 校验规则

| 规则编码 | 规则名称 | 校验逻辑 | 触发时机 |
|---------|---------|---------|---------|
| VR_BALANCE | 借贷平衡校验 | FDEBITAMOUNT = FCREDITAMOUNT | 保存前 |
| VR_ACCOUNTVALID | 科目有效性校验 | 科目必须存在且未禁用 | 保存前 |
| VR_ACCOUNTDETAIL | 明细科目校验 | 必须选择最明细科目 | 保存前 |
| VR_AMOUNTNOTZERO | 金额非零校验 | 借方或贷方金额不能同时为0 | 保存前 |
| VR_AMOUNTNOTBOTH | 借贷互斥校验 | 借方和贷方不能同时有金额 | 保存前 |
| VR_AUXILIARY | 辅助核算完整性校验 | 科目有辅助核算时必须填写 | 保存前 |
| VR_CASHFLOW | 现金流量完整性校验 | 现金类科目必须指定流量 | 保存前 |
| VR_PERIODCLOSED | 期间关闭校验 | 会计期间不能已结账 | 保存前 |
| VR_APPROVERNOTCREATOR | 审核人制单人互斥 | 审核人不能是制单人 | 审核前 |

---

## 七、插件挂载点配置

### 7.1 服务端插件挂载点

| 挂载点 | 插件类 | 说明 |
|--------|--------|------|
| BeforeSave | VoucherBeforeSavePlugin | 保存前校验 |
| AfterSave | VoucherAfterSavePlugin | 保存后处理 |
| BeforeSubmit | VoucherBeforeSubmitPlugin | 提交前校验 |
| AfterSubmit | VoucherAfterSubmitPlugin | 提交后处理 |
| BeforeAudit | VoucherBeforeAuditPlugin | 审核前校验 |
| AfterAudit | VoucherAfterAuditPlugin | 审核后处理 |
| BeforeUnAudit | VoucherBeforeUnAuditPlugin | 反审核前校验 |
| AfterUnAudit | VoucherAfterUnAuditPlugin | 反审核后处理 |
| BeforePost | VoucherBeforePostPlugin | 记账前校验 |
| AfterPost | VoucherAfterPostPlugin | 记账后处理 |
| BeforeUnPost | VoucherBeforeUnPostPlugin | 反记账前校验 |
| AfterUnPost | VoucherAfterUnPostPlugin | 反记账后处理 |

### 7.2 客户端插件挂载点

| 挂载点 | 插件类 | 说明 |
|--------|--------|------|
| FormLoad | VoucherFormLoadPlugin | 表单加载 |
| BeforeDoOperation | VoucherBeforeDoOperationPlugin | 操作前处理 |
| AfterDoOperation | VoucherAfterDoOperationPlugin | 操作后处理 |
| EntryRowClick | VoucherEntryRowClickPlugin | 分录行点击 |
| EntryCellValueChanged | VoucherEntryCellValueChangedPlugin | 分录单元格值改变 |
| BillValueChanged | VoucherBillValueChangedPlugin | 单据值改变 |

---

## 八、列表界面设计

### 8.1 列表显示字段

| 字段编码 | 字段名称 | 宽度 | 排序 | 冻结 |
|---------|---------|------|------|------|
| FVOUCHERNO | 凭证号 | 120 | 是 | 是 |
| FVOUCHERTYPENAME | 凭证类型 | 80 | 是 | 是 |
| FVOUCHERDATE | 凭证日期 | 100 | 是 | 是 |
| FACCOUNTINGPERIOD | 会计期间 | 80 | 是 | - |
| FDEBITAMOUNT | 借方金额 | 120 | 是 | - |
| FCREDITAMOUNT | 贷方金额 | 120 | 是 | - |
| FCREATORNAME | 制单人 | 80 | 是 | - |
| FCREATEDATE | 制单日期 | 150 | 是 | - |
| FDOCUMENTSTATUS | 单据状态 | 80 | 是 | - |
| FISPOSTED | 记账状态 | 80 | 是 | - |
| FATTACHMENTCOUNT | 附件数 | 60 | - | - |

### 8.2 列表过滤条件

| 过滤项 | 字段 | 类型 | 默认值 |
|--------|------|------|--------|
| 会计期间 | FACCOUNTINGPERIOD | 期间选择器 | 当前期间 |
| 凭证日期 | FVOUCHERDATE | 日期范围 | 本月 |
| 凭证类型 | FVOUCHERTYPEID | F7多选 | 全部 |
| 凭证号 | FVOUCHERNO | 文本 | - |
| 科目 | FACCOUNTID | F7 | - |
| 金额范围 | FDEBITAMOUNT | 数值范围 | - |
| 制单人 | FCREATORID | F7多选 | - |
| 审核状态 | FDOCUMENTSTATUS | 下拉 | 全部 |
| 记账状态 | FISPOSTED | 下拉 | 全部 |
| 摘要关键字 | FSUMMARY | 文本 | - |

### 8.3 列表操作按钮

| 按钮 | 功能 | 批量操作 |
|------|------|---------|
| 新增 | 打开凭证录入界面 | - |
| 修改 | 打开凭证修改界面 | 否 |
| 删除 | 删除凭证 | 是 |
| 审核 | 审核凭证 | 是 |
| 反审核 | 取消审核 | 是 |
| 记账 | 记账处理 | 是 |
| 反记账 | 取消记账 | 是 |
| 红冲 | 红字冲销 | 否 |
| 打印 | 打印凭证 | 是 |
| 导出 | 导出Excel | 是 |
| 联查明细账 | 打开明细账 | 否 |

---

## 九、打印模板设计

### 9.1 标准凭证打印模板

#### 模板规格
- 纸张：A4（210mm × 297mm）
- 方向：横向
- 边距：上15mm，下15mm，左20mm，右20mm

#### 打印内容布局

```
┌─────────────────────────────────────────────────────────────────┐
│                        记 账 凭 证                               │
│                                                                │
│  凭证日期: 2024年01月15日    凭证号: 记-202401-0001            │
│  会计期间: 2024年01月        附件数: 2张                       │
│                                                                │
├──────────┬──────────┬──────────────┬──────────────┬──────────┤
│  摘要    │  科目    │   借方金额   │   贷方金额   │ 辅助核算 │
├──────────┼──────────┼──────────────┼──────────────┼──────────┤
│ 收到货款 │ 银行存款 │ 100,000.00   │              │          │
│          │ 工商银行 │              │              │          │
├──────────┼──────────┼──────────────┼──────────────┼──────────┤
│ 收到货款 │ 应收账款 │              │ 100,000.00   │ A公司    │
│          │ A公司    │              │              │          │
├──────────┼──────────┼──────────────┼──────────────┼──────────┤
│  合计    │          │ 100,000.00   │ 100,000.00   │          │
└──────────┴──────────┴──────────────┴──────────────┴──────────┘
│                                                                │
│  制单人: _________    审核人: _________    记账人: _________  │
│                                                                │
└─────────────────────────────────────────────────────────────────┘
```

### 9.2 套打模板配置

| 模板类型 | 纸张规格 | 适用场景 |
|---------|---------|---------|
| 标准A4 | A4横向 | 普通打印 |
| 凭证套打 | 240mm×140mm | 专用凭证纸 |
| 连续打印 | 241mm×93mm | 针式打印机 |

---

## 十、权限控制设计

### 10.1 功能权限

| 权限项编码 | 权限项名称 | 说明 |
|-----------|-----------|------|
| VOUCHER_VIEW | 查看凭证 | 查看凭证列表和详情 |
| VOUCHER_CREATE | 新增凭证 | 创建新凭证 |
| VOUCHER_EDIT | 修改凭证 | 修改未审核凭证 |
| VOUCHER_DELETE | 删除凭证 | 删除未审核凭证 |
| VOUCHER_SUBMIT | 提交凭证 | 提交审核 |
| VOUCHER_AUDIT | 审核凭证 | 审核/反审核 |
| VOUCHER_POST | 记账凭证 | 记账/反记账 |
| VOUCHER_REDCANCEL | 红冲凭证 | 红字冲销 |
| VOUCHER_PRINT | 打印凭证 | 打印和预览 |
| VOUCHER_EXPORT | 导出凭证 | 导出Excel/PDF |

### 10.2 数据权限

| 权限维度 | 说明 |
|---------|------|
| 组织范围 | 只能查看本组织凭证 |
| 期间范围 | 只能查看未结账期间凭证 |
| 制单人范围 | 只能查看自己制作的凭证（可配置） |

### 10.3 字段权限

| 字段 | 制单人 | 审核人 | 记账人 | 查询人 |
|------|--------|--------|--------|--------|
| 凭证号 | 只读 | 只读 | 只读 | 只读 |
| 凭证日期 | 可编辑 | 只读 | 只读 | 只读 |
| 金额 | 可编辑 | 只读 | 只读 | 只读 |
| 审核信息 | 隐藏 | 可编辑 | 只读 | 只读 |
| 记账信息 | 隐藏 | 隐藏 | 可编辑 | 只读 |

---

## 十一、接口设计

### 11.1 外部系统接口

| 接口名称 | 接口类型 | 说明 |
|---------|---------|------|
| IVoucherService | WebAPI | 凭证查询接口 |
| IVoucherCreateService | WebAPI | 凭证创建接口 |
| IVoucherAuditService | WebAPI | 凭证审核接口 |
| IVoucherPostService | WebAPI | 凭证记账接口 |

### 11.2 内部系统接口

| 接口名称 | 调用方 | 说明 |
|---------|--------|------|
| IGeneralLedgerService | 总账模块 | 更新总账余额 |
| ICashFlowService | 现金流量模块 | 更新现金流量 |
| IAuxiliaryService | 辅助核算模块 | 更新辅助账 |

---

## 十二、附录

### 12.1 状态流转图

```
制单(A) → 提交(B) → 审核(C) → 记账(D)
  ↑        ↓         ↓         ↓
  └────反审核────反记账────红冲
```

### 12.2 错误码定义

| 错误码 | 错误信息 | 处理建议 |
|--------|---------|---------|
| V001 | 借贷不平衡 | 检查分录金额 |
| V002 | 科目不存在 | 重新选择科目 |
| V003 | 非明细科目 | 选择最明细科目 |
| V004 | 期间已结账 | 选择未结账期间 |
| V005 | 审核人制单人相同 | 更换审核人 |
| V006 | 现金流量未指定 | 指定现金流量项目 |
| V007 | 辅助核算不完整 | 补充辅助核算信息 |

---

**文档版本**: V1.0  
**创建日期**: 2024-01-15  
**最后更新**: 2024-01-15  
**作者**: 银河星辰开发团队
