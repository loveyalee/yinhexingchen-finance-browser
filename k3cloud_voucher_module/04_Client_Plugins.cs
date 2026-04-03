using System;
using System.Collections.Generic;
using System.Linq;
using Kingdee.BOS;
using Kingdee.BOS.Core;
using Kingdee.BOS.Core.Bill;
using Kingdee.BOS.Core.DynamicForm;
using Kingdee.BOS.Core.DynamicForm.PlugIn;
using Kingdee.BOS.Core.DynamicForm.PlugIn.Args;
using Kingdee.BOS.Core.DynamicForm.PlugIn.ControlModel;
using Kingdee.BOS.Core.Metadata;
using Kingdee.BOS.Core.Metadata.FieldElement;
using Kingdee.BOS.Orm.DataEntity;
using Kingdee.BOS.ServiceHelper;

namespace Voucher.Client.PlugIn
{
    /// <summary>
    /// 凭证表单加载插件
    /// </summary>
    public class VoucherFormLoadPlugin : AbstractDynamicFormPlugIn
    {
        public override void OnInitialize(InitializeEventArgs e)
        {
            base.OnInitialize(e);
            this.Model.SetValue("FVOUCHERDATE", DateTime.Today);
        }

        public override void AfterBindData(EventArgs e)
        {
            base.AfterBindData(e);
            
            // 设置默认凭证类型
            if (this.Model.GetValue("FVOUCHERTYPEID") == null)
            {
                SetDefaultVoucherType();
            }
            
            // 设置默认会计期间
            if (this.Model.GetValue("FACCOUNTINGPERIOD") == null)
            {
                SetDefaultPeriod();
            }
            
            // 初始化凭证明细
            InitVoucherEntries();
            
            // 设置控件状态
            SetControlStatus();
        }

        /// <summary>
        /// 设置默认凭证类型
        /// </summary>
        private void SetDefaultVoucherType()
        {
            string sql = "SELECT FTYPEID FROM VOUCHER.T_VOUCHERTYPE WHERE FISDEFAULT = 1";
            object typeId = DBServiceHelper.ExecuteScalar(this.Context, sql, null);
            
            if (typeId != null)
            {
                this.Model.SetValue("FVOUCHERTYPEID", typeId);
            }
        }

        /// <summary>
        /// 设置默认会计期间
        /// </summary>
        private void SetDefaultPeriod()
        {
            DateTime today = DateTime.Today;
            string period = string.Format("{0}-{1}", today.Year, today.Month.ToString("00"));
            this.Model.SetValue("FACCOUNTINGPERIOD", period);
            this.Model.SetValue("FPERIODYEAR", today.Year);
            this.Model.SetValue("FPERIODNUMBER", today.Month);
        }

        /// <summary>
        /// 初始化凭证明细
        /// </summary>
        private void InitVoucherEntries()
        {
            DynamicObjectCollection entries = this.Model.GetEntityDataObject("FEntity");
            
            // 默认添加5行
            if (entries.Count == 0)
            {
                for (int i = 0; i < 5; i++)
                {
                    DynamicObject newEntry = new DynamicObject();
                    newEntry["FEntrySeq"] = i + 1;
                    entries.Add(newEntry);
                }
            }
        }

        /// <summary>
        /// 设置控件状态
        /// </summary>
        private void SetControlStatus()
        {
            string docStatus = Convert.ToString(this.Model.GetValue("FDOCUMENTSTATUS"));
            bool isPosted = Convert.ToBoolean(this.Model.GetValue("FISPOSTED"));
            
            // 已记账或已审核，锁定单据
            bool isLocked = isPosted || docStatus == "C" || docStatus == "D";
            
            // 设置表头控件状态
            this.View.SetEnable("FVOUCHERTYPEID", !isLocked);
            this.View.SetEnable("FVOUCHERDATE", !isLocked);
            this.View.SetEnable("FACCOUNTINGPERIOD", !isLocked);
            this.View.SetEnable("FATTACHMENTCOUNT", !isLocked);
            this.View.SetEnable("FREMARK", !isLocked);
            
            // 设置分录控件状态
            this.View.SetEnable("FEntity", !isLocked);
        }
    }

    /// <summary>
    /// 凭证明细单元格值改变插件
    /// </summary>
    public class VoucherEntryCellChangedPlugin : AbstractDynamicFormPlugIn
    {
        public override void DataChanged(DataChangedEventArgs e)
        {
            base.DataChanged(e);
            
            string key = e.Field.Key.ToUpper();
            
            switch (key)
            {
                case "FACCOUNTID":
                    OnAccountChanged(e);
                    break;
                case "FSUMMARY":
                    OnSummaryChanged(e);
                    break;
                case "FDEBITAMOUNT":
                case "FCREDITAMOUNT":
                    OnAmountChanged(e);
                    break;
                case "FISSAMESUMMARY":
                    OnSameSummaryChanged(e);
                    break;
            }
        }

        /// <summary>
        /// 科目改变时
        /// </summary>
        private void OnAccountChanged(DataChangedEventArgs e)
        {
            if (e.NewValue == null) return;
            
            long accountId = Convert.ToInt64(e.NewValue);
            DynamicObject row = e.Row;
            
            // 获取科目信息
            string sql = $@"
                SELECT FNumber, FName, FFullName, FDirection
                FROM T_BD_Account
                WHERE FAccountId = {accountId}";
            
            DynamicObject account = DBServiceHelper.ExecuteDynamicObject(this.Context, sql);
            
            if (account != null)
            {
                row["FACCOUNTNUMBER"] = account["FNumber"];
                row["FACCOUNTNAME"] = account["FName"];
                row["FACCOUNTFULLNAME"] = account["FFullName"];
                row["FACCOUNTDIRECTION"] = account["FDirection"];
                
                // 检查是否需要现金流量
                CheckCashFlowRequired(accountId);
                
                // 检查辅助核算
                LoadAuxiliaryConfig(accountId, row);
            }
            
            // 自动填充常用摘要
            AutoFillSummary(accountId, row);
        }

        /// <summary>
        /// 摘要改变时
        /// </summary>
        private void OnSummaryChanged(DataChangedEventArgs e)
        {
            DynamicObject row = e.Row;
            string summary = Convert.ToString(e.NewValue);
            
            if (!string.IsNullOrEmpty(summary))
            {
                // 保存到常用摘要
                SaveToCommonSummary(summary);
            }
        }

        /// <summary>
        /// 金额改变时
        /// </summary>
        private void OnAmountChanged(DataChangedEventArgs e)
        {
            DynamicObject row = e.Row;
            string key = e.Field.Key.ToUpper();
            
            // 借贷互斥
            if (key == "FDEBITAMOUNT")
            {
                decimal debit = Convert.ToDecimal(e.NewValue);
                if (debit > 0)
                {
                    row["FCREDITAMOUNT"] = 0;
                }
            }
            else if (key == "FCREDITAMOUNT")
            {
                decimal credit = Convert.ToDecimal(e.NewValue);
                if (credit > 0)
                {
                    row["FDEBITAMOUNT"] = 0;
                }
            }
            
            // 自动平衡
            AutoBalance(e.Row);
            
            // 计算合计
            CalculateTotal();
        }

        /// <summary>
        /// 同上摘要改变时
        /// </summary>
        private void OnSameSummaryChanged(DataChangedEventArgs e)
        {
            bool isSame = Convert.ToBoolean(e.NewValue);
            if (isSame)
            {
                DynamicObjectCollection entries = this.Model.GetEntityDataObject("FEntity");
                int rowIndex = e.RowIndex;
                
                if (rowIndex > 0)
                {
                    DynamicObject prevRow = entries[rowIndex - 1];
                    e.Row["FSUMMARY"] = prevRow["FSUMMARY"];
                }
            }
        }

        /// <summary>
        /// 检查是否需要现金流量
        /// </summary>
        private void CheckCashFlowRequired(long accountId)
        {
            string sql = $@"
                SELECT FIsCash
                FROM T_BD_Account
                WHERE FAccountId = {accountId}";
            
            object isCash = DBServiceHelper.ExecuteScalar(this.Context, sql, null);
            
            if (isCash != null && isCash.ToString() == "1")
            {
                this.Model.SetValue("FISCASHFLOWREQUIRED", true);
            }
        }

        /// <summary>
        /// 加载辅助核算配置
        /// </summary>
        private void LoadAuxiliaryConfig(long accountId, DynamicObject row)
        {
            string sql = $@"
                SELECT FCheckType
                FROM T_BD_AccountAuxiliary
                WHERE FAccountId = {accountId} AND FIsEnable = 1";
            
            DynamicObjectCollection auxConfigs = DBServiceHelper.ExecuteDynamicObjectCollection(this.Context, sql);
            
            foreach (DynamicObject config in auxConfigs)
            {
                string checkType = Convert.ToString(config["FCheckType"]);
                
                // 显示对应的辅助核算控件
                switch (checkType)
                {
                    case "BD_MATERIAL":
                        this.View.SetVisible("FMATERIALID", true, e.RowIndex);
                        break;
                    case "BD_CUSTOMER":
                        this.View.SetVisible("FCUSTOMERID", true, e.RowIndex);
                        break;
                    case "BD_SUPPLIER":
                        this.View.SetVisible("FSUPPLIERID", true, e.RowIndex);
                        break;
                    case "BD_DEPARTMENT":
                        this.View.SetVisible("FDEPTID", true, e.RowIndex);
                        break;
                    case "BD_EMPLOYEE":
                        this.View.SetVisible("FEMPLOYEEID", true, e.RowIndex);
                        break;
                    case "BD_PROJECT":
                        this.View.SetVisible("FPROJECTID", true, e.RowIndex);
                        break;
                }
            }
        }

        /// <summary>
        /// 自动填充常用摘要
        /// </summary>
        private void AutoFillSummary(long accountId, DynamicObject row)
        {
            string sql = $@"
                SELECT TOP 1 FSUMMARY
                FROM VOUCHER.T_SUMMARYTEMPLATE
                WHERE FACCOUNTID = {accountId}
                ORDER BY FCREATEDATE DESC";
            
            string summary = DBServiceHelper.ExecuteScalar<string>(this.Context, sql, null);
            
            if (!string.IsNullOrEmpty(summary) && string.IsNullOrEmpty(Convert.ToString(row["FSUMMARY"])))
            {
                row["FSUMMARY"] = summary;
            }
        }

        /// <summary>
        /// 保存到常用摘要
        /// </summary>
        private void SaveToCommonSummary(string summary)
        {
            // 检查是否已存在
            string sql = $@"
                SELECT COUNT(1)
                FROM VOUCHER.T_SUMMARYTEMPLATE
                WHERE FSUMMARY = '{summary.Replace("'", "''")}'";
            
            int count = DBServiceHelper.ExecuteScalar<int>(this.Context, sql, 0);
            
            if (count == 0)
            {
                // 自动保存（可选功能）
            }
        }

        /// <summary>
        /// 自动平衡
        /// </summary>
        private void AutoBalance(DynamicObject row)
        {
            // 获取当前行的借贷方
            decimal debit = Convert.ToDecimal(row["FDEBITAMOUNT"]);
            decimal credit = Convert.ToDecimal(row["FCREDITAMOUNT"]);
            
            // 如果当前行有金额，不做自动平衡
            if (debit > 0 || credit > 0) return;
            
            // 计算当前借贷合计
            CalculateTotal();
            
            // 获取合计
            decimal totalDebit = Convert.ToDecimal(this.Model.GetValue("FDEBITAMOUNT"));
            decimal totalCredit = Convert.ToDecimal(this.Model.GetValue("FCREDITAMOUNT"));
            decimal diff = totalDebit - totalCredit;
            
            // 如果有差额，自动填充当前行
            if (Math.Abs(diff) >= 0.01m)
            {
                if (diff > 0)
                {
                    row["FCREDITAMOUNT"] = Math.Abs(diff);
                }
                else
                {
                    row["FDEBITAMOUNT"] = Math.Abs(diff);
                }
            }
        }

        /// <summary>
        /// 计算借贷合计
        /// </summary>
        private void CalculateTotal()
        {
            DynamicObjectCollection entries = this.Model.GetEntityDataObject("FEntity");
            
            decimal totalDebit = 0;
            decimal totalCredit = 0;
            
            foreach (DynamicObject entry in entries)
            {
                decimal debit = Convert.ToDecimal(entry["FDEBITAMOUNT"]);
                decimal credit = Convert.ToDecimal(entry["FCREDITAMOUNT"]);
                
                totalDebit += debit;
                totalCredit += credit;
            }
            
            this.Model.SetValue("FDEBITAMOUNT", totalDebit);
            this.Model.SetValue("FCREDITAMOUNT", totalCredit);
            this.Model.SetValue("FDIFFAMOUNT", totalDebit - totalCredit);
        }
    }

    /// <summary>
    /// 凭证常用摘要快捷录入插件
    /// </summary>
    public class VoucherSummaryQuickInputPlugin : AbstractDynamicFormPlugIn
    {
        public override void AfterBindData(EventArgs e)
        {
            base.AfterBindData(e);
            
            // 加载常用摘要
            LoadCommonSummaries();
        }

        /// <summary>
        /// 加载常用摘要
        /// </summary>
        private void LoadCommonSummaries()
        {
            string sql = @"
                SELECT FTEMPLATENUMBER, FTEMPLATENAME, FSUMMARY
                FROM VOUCHER.T_SUMMARYTEMPLATE
                WHERE FFORBIDSTATUS = 'A'
                ORDER BY FTEMPLATENUMBER";
            
            DynamicObjectCollection summaries = DBServiceHelper.ExecuteDynamicObjectCollection(this.Context, sql);
            
            // 绑定到摘要下拉框
            ComboControl combo = this.View.GetControl<ComboControl>("FSUMMARY");
            if (combo != null)
            {
                List<ListItem> items = new List<ListItem>();
                
                foreach (DynamicObject summary in summaries)
                {
                    items.Add(new ListItem
                    {
                        Id = summary["FTEMPLATENUMBER"].ToString(),
                        Name = summary["FTEMPLATENAME"].ToString(),
                        Value = summary["FSUMMARY"].ToString()
                    });
                }
                
                combo.SetComboItems(items);
            }
        }

        /// <summary>
        /// 显示常用摘要选择对话框
        /// </summary>
        public void ShowSummaryDialog()
        {
            // 加载常用摘要
            LoadCommonSummaries();
            
            // 打开F7选择框
            this.View.ShowF7("FSUMMARY", null, true);
        }
    }

    /// <summary>
    /// 凭证明细行操作插件
    /// </summary>
    public class VoucherEntryRowPlugin : AbstractDynamicFormPlugIn
    {
        public override void EntryRowClick(EntryRowClickEventArgs e)
        {
            base.EntryRowClick(e);
            
            // 处理行点击事件
            if (e.Row != null)
            {
                // 可以添加行点击后的逻辑
            }
        }

        public override void BeforeDoOperation(BeforeDoOperationEventArgs e)
        {
            base.BeforeDoOperation(e);
            
            string operationKey = e.Operation.OperationFormId;
            
            switch (operationKey)
            {
                case "NewRow":
                    OnNewRow(e);
                    break;
                case "DeleteRow":
                    OnDeleteRow(e);
                    break;
                case "CopyRow":
                    OnCopyRow(e);
                    break;
                case "InsertRow":
                    OnInsertRow(e);
                    break;
            }
        }

        private void OnNewRow(BeforeDoOperationEventArgs e)
        {
            // 新增行时自动设置行号
            DynamicObjectCollection entries = this.Model.GetEntityDataObject("FEntity");
            int nextSeq = entries.Count + 1;
            
            DynamicObject newRow = new DynamicObject();
            newRow["FEntrySeq"] = nextSeq;
            entries.Add(newRow);
            
            e.Cancel = true;
        }

        private void OnDeleteRow(BeforeDoOperationEventArgs e)
        {
            // 检查是否有数据
            DynamicObjectCollection entries = this.Model.GetEntityDataObject("FEntity");
            
            if (entries.Count <= 1)
            {
                this.View.ShowWarning("至少保留一条分录！");
                e.Cancel = true;
                return;
            }
            
            // 检查状态
            string docStatus = Convert.ToString(this.Model.GetValue("FDOCUMENTSTATUS"));
            bool isPosted = Convert.ToBoolean(this.Model.GetValue("FISPOSTED"));
            
            if (isPosted || docStatus == "C" || docStatus == "D")
            {
                this.View.ShowWarning("已审核或已记账的凭证不能删除分录！");
                e.Cancel = true;
                return;
            }
        }

        private void OnCopyRow(BeforeDoOperationEventArgs e)
        {
            // 复制当前行
            DynamicObjectCollection entries = this.Model.GetEntityDataObject("FEntity");
            int currentIndex = this.Model.GetEntityCurrentIndex("FEntity");
            
            if (currentIndex >= 0 && currentIndex < entries.Count)
            {
                DynamicObject sourceRow = entries[currentIndex];
                DynamicObject newRow = new DynamicObject();
                
                // 复制字段（排除主键）
                foreach (var field in sourceRow.DynamicObjectType.Properties)
                {
                    if (field.Name != "FEntryID" && field.Name != "FEntrySeq")
                    {
                        newRow[field.Name] = sourceRow[field.Name];
                    }
                }
                
                newRow["FEntrySeq"] = entries.Count + 1;
                entries.Add(newRow);
                
                // 重新计算合计
                CalculateTotal();
            }
            
            e.Cancel = true;
        }

        private void OnInsertRow(BeforeDoOperationEventArgs e)
        {
            // 在当前行前插入
            DynamicObjectCollection entries = this.Model.GetEntityDataObject("FEntity");
            int currentIndex = this.Model.GetEntityCurrentIndex("FEntity");
            
            DynamicObject newRow = new DynamicObject();
            newRow["FEntrySeq"] = currentIndex + 1;
            
            entries.Insert(currentIndex, newRow);
            
            // 重新排序号
            for (int i = 0; i < entries.Count; i++)
            {
                entries[i]["FEntrySeq"] = i + 1;
            }
            
            e.Cancel = true;
        }

        private void CalculateTotal()
        {
            DynamicObjectCollection entries = this.Model.GetEntityDataObject("FEntity");
            
            decimal totalDebit = 0;
            decimal totalCredit = 0;
            
            foreach (DynamicObject entry in entries)
            {
                decimal debit = Convert.ToDecimal(entry["FDEBITAMOUNT"]);
                decimal credit = Convert.ToDecimal(entry["FCREDITAMOUNT"]);
                
                totalDebit += debit;
                totalCredit += credit;
            }
            
            this.Model.SetValue("FDEBITAMOUNT", totalDebit);
            this.Model.SetValue("FCREDITAMOUNT", totalCredit);
            this.Model.SetValue("FDIFFAMOUNT", totalDebit - totalCredit);
        }
    }

    /// <summary>
    /// 凭证操作前处理插件
    /// </summary>
    public class VoucherBeforeDoOperationPlugin : AbstractDynamicFormPlugIn
    {
        public override void BeforeDoOperation(BeforeDoOperationEventArgs e)
        {
            base.BeforeDoOperation(e);
            
            string operationKey = e.Operation.OperationFormId;
            
            switch (operationKey)
            {
                case "Save":
                    OnBeforeSave(e);
                    break;
                case "Audit":
                    OnBeforeAudit(e);
                    break;
                case "UnAudit":
                    OnBeforeUnAudit(e);
                    break;
                case "Post":
                    OnBeforePost(e);
                    break;
                case "UnPost":
                    OnBeforeUnPost(e);
                    break;
                case "RedCancel":
                    OnBeforeRedCancel(e);
                    break;
            }
        }

        private void OnBeforeSave(BeforeDoOperationEventArgs e)
        {
            // 1. 校验借贷平衡
            if (!ValidateBalance())
            {
                e.Cancel = true;
                return;
            }
            
            // 2. 校验必填项
            if (!ValidateRequired())
            {
                e.Cancel = true;
                return;
            }
            
            // 3. 校验科目
            if (!ValidateAccount())
            {
                e.Cancel = true;
                return;
            }
        }

        private void OnBeforeAudit(BeforeDoOperationEventArgs e)
        {
            // 校验审核人与制单人
            long creatorId = Convert.ToInt64(this.Model.GetValue("FCREATORID"));
            long currentUserId = this.Context.UserId;
            
            if (creatorId == currentUserId)
            {
                this.View.ShowWarning("审核人不能与制单人相同！");
                e.Cancel = true;
                return;
            }
        }

        private void OnBeforeUnAudit(BeforeDoOperationEventArgs e)
        {
            // 校验是否已记账
            bool isPosted = Convert.ToBoolean(this.Model.GetValue("FISPOSTED"));
            
            if (isPosted)
            {
                this.View.ShowWarning("已记账的凭证不能反审核！");
                e.Cancel = true;
                return;
            }
        }

        private void OnBeforePost(BeforeDoOperationEventArgs e)
        {
            // 校验是否已审核
            string docStatus = Convert.ToString(this.Model.GetValue("FDOCUMENTSTATUS"));
            
            if (docStatus != "C")
            {
                this.View.ShowWarning("请先审核凭证！");
                e.Cancel = true;
                return;
            }
            
            // 校验是否已记账
            bool isPosted = Convert.ToBoolean(this.Model.GetValue("FISPOSTED"));
            
            if (isPosted)
            {
                this.View.ShowWarning("凭证已记账！");
                e.Cancel = true;
                return;
            }
        }

        private void OnBeforeUnPost(BeforeDoOperationEventArgs e)
        {
            // 校验期间是否已结账
            string period = Convert.ToString(this.Model.GetValue("FACCOUNTINGPERIOD"));
            long orgId = Convert.ToInt64(this.Model.GetValue("FORGID"));
            
            string sql = $@"
                SELECT FIsClosed
                FROM T_GL_PeriodStatus
                WHERE FOrgId = {orgId} AND FPeriod = '{period}'";
            
            object isClosed = DBServiceHelper.ExecuteScalar(this.Context, sql, null);
            
            if (isClosed != null && isClosed.ToString() == "1")
            {
                this.View.ShowWarning("该期间已结账，不能反记账！");
                e.Cancel = true;
                return;
            }
        }

        private void OnBeforeRedCancel(BeforeDoOperationEventArgs e)
        {
            // 校验是否已记账
            bool isPosted = Convert.ToBoolean(this.Model.GetValue("FISPOSTED"));
            
            if (!isPosted)
            {
                this.View.ShowWarning("只有已记账的凭证才能红冲！");
                e.Cancel = true;
                return;
            }
        }

        private bool ValidateBalance()
        {
            decimal totalDebit = Convert.ToDecimal(this.Model.GetValue("FDEBITAMOUNT"));
            decimal totalCredit = Convert.ToDecimal(this.Model.GetValue("FCREDITAMOUNT"));
            decimal diff = Math.Abs(totalDebit - totalCredit);
            
            if (diff >= 0.01m)
            {
                this.View.ShowWarning(string.Format("借贷不平衡，差额为：{0:F2}", diff));
                return false;
            }
            
            return true;
        }

        private bool ValidateRequired()
        {
            // 校验表头必填
            if (this.Model.GetValue("FVOUCHERTYPEID") == null)
            {
                this.View.ShowWarning("请选择凭证类型！");
                return false;
            }
            
            if (this.Model.GetValue("FVOUCHERDATE") == null)
            {
                this.View.ShowWarning("请选择凭证日期！");
                return false;
            }
            
            // 校验分录必填
            DynamicObjectCollection entries = this.Model.GetEntityDataObject("FEntity");
            
            for (int i = 0; i < entries.Count; i++)
            {
                DynamicObject entry = entries[i];
                
                if (entry["FACCOUNTID"] == null || Convert.ToInt64(entry["FACCOUNTID"]) == 0)
                {
                    this.View.ShowWarning(string.Format("第{0}行请选择科目！", i + 1));
                    return false;
                }
                
                if (string.IsNullOrEmpty(Convert.ToString(entry["FSUMMARY"])))
                {
                    this.View.ShowWarning(string.Format("第{0}行请填写摘要！", i + 1));
                    return false;
                }
                
                decimal debit = Convert.ToDecimal(entry["FDEBITAMOUNT"]);
                decimal credit = Convert.ToDecimal(entry["FCREDITAMOUNT"]);
                
                if (debit <= 0 && credit <= 0)
                {
                    this.View.ShowWarning(string.Format("第{0}行请填写借方或贷方金额！", i + 1));
                    return false;
                }
            }
            
            return true;
        }

        private bool ValidateAccount()
        {
            DynamicObjectCollection entries = this.Model.GetEntityDataObject("FEntity");
            
            for (int i = 0; i < entries.Count; i++)
            {
                DynamicObject entry = entries[i];
                long accountId = Convert.ToInt64(entry["FACCOUNTID"]);
                
                // 校验科目是否存在且未禁用
                string sql = $@"
                    SELECT FIsDetail, FForbidStatus
                    FROM T_BD_Account
                    WHERE FAccountId = {accountId}";
                
                DynamicObject account = DBServiceHelper.ExecuteDynamicObject(this.Context, sql);
                
                if (account == null)
                {
                    this.View.ShowWarning(string.Format("第{0}行科目不存在！", i + 1));
                    return false;
                }
                
                bool isDetail = account["FIsDetail"].ToString() == "1";
                string forbidStatus = account["FForbidStatus"].ToString();
                
                if (!isDetail)
                {
                    this.View.ShowWarning(string.Format("第{0}行请选择最明细科目！", i + 1));
                    return false;
                }
                
                if (forbidStatus == "B")
                {
                    this.View.ShowWarning(string.Format("第{0}行科目已禁用！", i + 1));
                    return false;
                }
            }
            
            return true;
        }
    }

    /// <summary>
    /// 凭证操作后处理插件
    /// </summary>
    public class VoucherAfterDoOperationPlugin : AbstractDynamicFormPlugIn
    {
        public override void AfterDoOperation(AfterDoOperationEventArgs e)
        {
            base.AfterDoOperation(e);
            
            string operationKey = e.Operation.OperationFormId;
            
            switch (operationKey)
            {
                case "Save":
                    OnAfterSave(e);
                    break;
                case "Audit":
                    OnAfterAudit(e);
                    break;
                case "Post":
                    OnAfterPost(e);
                    break;
            }
        }

        private void OnAfterSave(AfterDoOperationEventArgs e)
        {
            // 保存成功后，显示提示
            this.View.ShowMessage("保存成功！");
        }

        private void OnAfterAudit(AfterDoOperationEventArgs e)
        {
            // 审核成功后，刷新控件状态
            SetControlStatus();
            this.View.ShowMessage("审核成功！");
        }

        private void OnAfterPost(AfterDoOperationEventArgs e)
        {
            // 记账成功后，刷新控件状态
            SetControlStatus();
            this.View.ShowMessage("记账成功！");
        }

        private void SetControlStatus()
        {
            string docStatus = Convert.ToString(this.Model.GetValue("FDOCUMENTSTATUS"));
            bool isPosted = Convert.ToBoolean(this.Model.GetValue("FISPOSTED"));
            
            // 已记账或已审核，锁定单据
            bool isLocked = isPosted || docStatus == "C" || docStatus == "D";
            
            // 设置表头控件状态
            this.View.SetEnable("FVOUCHERTYPEID", !isLocked);
            this.View.SetEnable("FVOUCHERDATE", !isLocked);
            this.View.SetEnable("FACCOUNTINGPERIOD", !isLocked);
            this.View.SetEnable("FATTACHMENTCOUNT", !isLocked);
            this.View.SetEnable("FREMARK", !isLocked);
            
            // 设置分录控件状态
            this.View.SetEnable("FEntity", !isLocked);
        }
    }
}
