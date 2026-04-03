using System;
using System.Collections.Generic;
using System.Data;
using System.Linq;
using System.Text;
using Kingdee.BOS;
using Kingdee.BOS.App.Data;
using Kingdee.BOS.Core.DynamicForm;
using Kingdee.BOS.Core.DynamicForm.PlugIn;
using Kingdee.BOS.Core.DynamicForm.PlugIn.Args;
using Kingdee.BOS.Core.DynamicForm.PlugIn.ControlModel;
using Kingdee.BOS.Core.Metadata;
using Kingdee.BOS.Core.Metadata.FieldElement;
using Kingdee.BOS.Orm.DataEntity;

namespace Voucher.Server.PlugIn
{
    /// <summary>
    /// 凭证保存前校验插件
    /// </summary>
    public class VoucherBeforeSavePlugin : AbstractOperationServicePlugIn
    {
        public override void OnPreparePropertys(PreparePropertysEventArgs e)
        {
            base.OnPreparePropertys(e);
            e.FieldKeys.Add("FID");
            e.FieldKeys.Add("FVOUCHERNO");
            e.FieldKeys.Add("FVOUCHERDATE");
            e.FieldKeys.Add("FVOUCHERTYPEID");
            e.FieldKeys.Add("FACCOUNTINGPERIOD");
            e.FieldKeys.Add("FDEBITAMOUNT");
            e.FieldKeys.Add("FCREDITAMOUNT");
            e.FieldKeys.Add("FDIFFAMOUNT");
            e.FieldKeys.Add("FDOCUMENTSTATUS");
            e.FieldKeys.Add("FISPOSTED");
            e.FieldKeys.Add("FEntryID");
            e.FieldKeys.Add("FEntrySeq");
            e.FieldKeys.Add("FACCOUNTID");
            e.FieldKeys.Add("FSUMMARY");
            e.FieldKeys.Add("FEntryDebit");
            e.FieldKeys.Add("FEntryCredit");
        }

        public override void BeforeExecuteOperationTransaction(BeforeExecuteOperationTransaction e)
        {
            base.BeforeExecuteOperationTransaction(e);

            foreach (DynamicObject voucher in e.SelectedRows)
            {
                // 1. 校验借贷平衡
                ValidateBalance(voucher);

                // 2. 校验科目有效性
                ValidateAccount(voucher);

                // 3. 校验辅助核算完整性
                ValidateAuxiliary(voucher);

                // 4. 校验现金流量完整性
                ValidateCashFlow(voucher);

                // 5. 校验期间是否结账
                ValidatePeriodClosed(voucher);
            }
        }

        /// <summary>
        /// 校验借贷平衡
        /// </summary>
        private void ValidateBalance(DynamicObject voucher)
        {
            decimal debitAmount = voucher.GetVal<decimal>("FDEBITAMOUNT");
            decimal creditAmount = voucher.GetVal<decimal>("FCREDITAMOUNT");
            decimal diffAmount = Math.Abs(debitAmount - creditAmount);

            if (diffAmount >= 0.01m)
            {
                throw new Exception(string.Format("借贷不平衡，差额为：{0:F2}", diffAmount));
            }

            // 更新差额字段
            voucher["FDIFFAMOUNT"] = diffAmount;
        }

        /// <summary>
        /// 校验科目有效性
        /// </summary>
        private void ValidateAccount(DynamicObject voucher)
        {
            DynamicObjectCollection entries = voucher["FEntity"] as DynamicObjectCollection;

            for (int i = 0; i < entries.Count; i++)
            {
                DynamicObject entry = entries[i];
                long accountId = entry.GetVal<long>("FACCOUNTID");

                if (accountId == 0)
                {
                    throw new Exception(string.Format("第{0}行科目不能为空", i + 1));
                }

                // 校验是否是最明细科目
                string sql = $@"
                    SELECT FIsDetail, FForbidStatus 
                    FROM T_BD_Account 
                    WHERE FAccountId = {accountId}";

                DataTable dt = DBUtils.ExecuteDataSet(this.Context, sql).Tables[0];

                if (dt.Rows.Count == 0)
                {
                    throw new Exception(string.Format("第{0}行科目不存在", i + 1));
                }

                bool isDetail = dt.Rows[0]["FIsDetail"].ToString() == "1";
                string forbidStatus = dt.Rows[0]["FForbidStatus"].ToString();

                if (!isDetail)
                {
                    throw new Exception(string.Format("第{0}行必须选择最明细科目", i + 1));
                }

                if (forbidStatus == "B")
                {
                    throw new Exception(string.Format("第{0}行科目已禁用", i + 1));
                }
            }
        }

        /// <summary>
        /// 校验辅助核算完整性
        /// </summary>
        private void ValidateAuxiliary(DynamicObject voucher)
        {
            DynamicObjectCollection entries = voucher["FEntity"] as DynamicObjectCollection;

            for (int i = 0; i < entries.Count; i++)
            {
                DynamicObject entry = entries[i];
                long accountId = entry.GetVal<long>("FACCOUNTID");

                // 查询科目辅助核算配置
                string sql = $@"
                    SELECT FCheckType, FCheckTypeName
                    FROM T_BD_AccountAuxiliary
                    WHERE FAccountId = {accountId} AND FIsEnable = 1";

                DataTable dt = DBUtils.ExecuteDataSet(this.Context, sql).Tables[0];

                foreach (DataRow row in dt.Rows)
                {
                    string checkType = row["FCheckType"].ToString();
                    string checkTypeName = row["FCheckTypeName"].ToString();

                    long auxValue = 0;
                    switch (checkType)
                    {
                        case "BD_MATERIAL":
                            auxValue = entry.GetVal<long>("FMATERIALID");
                            break;
                        case "BD_CUSTOMER":
                            auxValue = entry.GetVal<long>("FCUSTOMERID");
                            break;
                        case "BD_SUPPLIER":
                            auxValue = entry.GetVal<long>("FSUPPLIERID");
                            break;
                        case "BD_DEPARTMENT":
                            auxValue = entry.GetVal<long>("FDEPTID");
                            break;
                        case "BD_EMPLOYEE":
                            auxValue = entry.GetVal<long>("FEMPLOYEEID");
                            break;
                        case "BD_PROJECT":
                            auxValue = entry.GetVal<long>("FPROJECTID");
                            break;
                    }

                    if (auxValue == 0)
                    {
                        throw new Exception(string.Format("第{0}行{1}不能为空", i + 1, checkTypeName));
                    }
                }
            }
        }

        /// <summary>
        /// 校验现金流量完整性
        /// </summary>
        private void ValidateCashFlow(DynamicObject voucher)
        {
            bool isCashFlowRequired = voucher.GetVal<bool>("FISCASHFLOWREQUIRED");

            if (!isCashFlowRequired) return;

            DynamicObjectCollection entries = voucher["FEntity"] as DynamicObjectCollection;

            for (int i = 0; i < entries.Count; i++)
            {
                DynamicObject entry = entries[i];
                long cashFlowItemId = entry.GetVal<long>("FCASHFLOWITEMID");

                if (cashFlowItemId == 0)
                {
                    throw new Exception(string.Format("第{0}行现金流量项目不能为空", i + 1));
                }
            }
        }

        /// <summary>
        /// 校验期间是否结账
        /// </summary>
        private void ValidatePeriodClosed(DynamicObject voucher)
        {
            string accountingPeriod = voucher.GetVal<string>("FACCOUNTINGPERIOD");
            long orgId = voucher.GetVal<long>("FORGID");

            string sql = $@"
                SELECT FIsClosed
                FROM T_GL_PeriodStatus
                WHERE FOrgId = {orgId} AND FPeriod = '{accountingPeriod}'";

            object result = DBUtils.ExecuteScalar(this.Context, sql, null);

            if (result != null && result.ToString() == "1")
            {
                throw new Exception(string.Format("会计期间{0}已结账，不能保存凭证", accountingPeriod));
            }
        }
    }

    /// <summary>
    /// 凭证保存后处理插件
    /// </summary>
    public class VoucherAfterSavePlugin : AbstractOperationServicePlugIn
    {
        public override void AfterExecuteOperationTransaction(AfterExecuteOperationArgs e)
        {
            base.AfterExecuteOperationTransaction(e);

            foreach (DynamicObject voucher in e.SelectedRows)
            {
                // 记录操作日志
                LogOperation(voucher, "SAVE", "保存凭证");
            }
        }

        private void LogOperation(DynamicObject voucher, string operationType, string operationName)
        {
            long voucherId = voucher.GetVal<long>("FID");
            string voucherNo = voucher.GetVal<string>("FVOUCHERNO");
            long operatorId = this.Context.UserId;

            string sql = $@"
                INSERT INTO VOUCHER.T_VOUCHERLOG 
                (FID, FVOUCHERNO, FOPERATIONTYPE, FOPERATIONNAME, FOPERATORID, FOPERATIONTIME, FOPERATIONRESULT)
                VALUES ({voucherId}, '{voucherNo}', '{operationType}', '{operationName}', {operatorId}, GETDATE(), 'SUCCESS')";

            DBUtils.Execute(this.Context, sql);
        }
    }

    /// <summary>
    /// 凭证审核前校验插件
    /// </summary>
    public class VoucherBeforeAuditPlugin : AbstractOperationServicePlugIn
    {
        public override void OnPreparePropertys(PreparePropertysEventArgs e)
        {
            base.OnPreparePropertys(e);
            e.FieldKeys.Add("FID");
            e.FieldKeys.Add("FVOUCHERNO");
            e.FieldKeys.Add("FCREATORID");
            e.FieldKeys.Add("FAPPROVERID");
            e.FieldKeys.Add("FDOCUMENTSTATUS");
        }

        public override void BeforeExecuteOperationTransaction(BeforeExecuteOperationTransaction e)
        {
            base.BeforeExecuteOperationTransaction(e);

            foreach (DynamicObject voucher in e.SelectedRows)
            {
                // 1. 校验审核人与制单人不能相同
                ValidateApproverNotCreator(voucher);

                // 2. 校验凭证状态
                ValidateStatusForAudit(voucher);
            }
        }

        /// <summary>
        /// 校验审核人与制单人不能相同
        /// </summary>
        private void ValidateApproverNotCreator(DynamicObject voucher)
        {
            long creatorId = voucher.GetVal<long>("FCREATORID");
            long approverId = this.Context.UserId;

            if (creatorId == approverId)
            {
                throw new Exception("审核人不能与制单人相同");
            }

            voucher["FAPPROVERID"] = approverId;
        }

        /// <summary>
        /// 校验凭证状态
        /// </summary>
        private void ValidateStatusForAudit(DynamicObject voucher)
        {
            string documentStatus = voucher.GetVal<string>("FDOCUMENTSTATUS");

            if (documentStatus != "A" && documentStatus != "B")
            {
                throw new Exception("只有制单或提交状态的凭证才能审核");
            }
        }
    }

    /// <summary>
    /// 凭证审核后处理插件
    /// </summary>
    public class VoucherAfterAuditPlugin : AbstractOperationServicePlugIn
    {
        public override void AfterExecuteOperationTransaction(AfterExecuteOperationArgs e)
        {
            base.AfterExecuteOperationTransaction(e);

            foreach (DynamicObject voucher in e.SelectedRows)
            {
                // 更新审核信息
                UpdateAuditInfo(voucher);

                // 记录操作日志
                LogOperation(voucher, "AUDIT", "审核凭证");
            }
        }

        private void UpdateAuditInfo(DynamicObject voucher)
        {
            long voucherId = voucher.GetVal<long>("FID");
            long approverId = this.Context.UserId;

            string sql = $@"
                UPDATE VOUCHER.T_VOUCHER
                SET FAPPROVERID = {approverId},
                    FAPPROVEDATE = GETDATE(),
                    FDOCUMENTSTATUS = 'C'
                WHERE FID = {voucherId}";

            DBUtils.Execute(this.Context, sql);
        }

        private void LogOperation(DynamicObject voucher, string operationType, string operationName)
        {
            long voucherId = voucher.GetVal<long>("FID");
            string voucherNo = voucher.GetVal<string>("FVOUCHERNO");
            long operatorId = this.Context.UserId;

            string sql = $@"
                INSERT INTO VOUCHER.T_VOUCHERLOG 
                (FID, FVOUCHERNO, FOPERATIONTYPE, FOPERATIONNAME, FOPERATORID, FOPERATIONTIME, FOPERATIONRESULT)
                VALUES ({voucherId}, '{voucherNo}', '{operationType}', '{operationName}', {operatorId}, GETDATE(), 'SUCCESS')";

            DBUtils.Execute(this.Context, sql);
        }
    }

    /// <summary>
    /// 凭证记账前校验插件
    /// </summary>
    public class VoucherBeforePostPlugin : AbstractOperationServicePlugIn
    {
        public override void OnPreparePropertys(PreparePropertysEventArgs e)
        {
            base.OnPreparePropertys(e);
            e.FieldKeys.Add("FID");
            e.FieldKeys.Add("FVOUCHERNO");
            e.FieldKeys.Add("FDOCUMENTSTATUS");
            e.FieldKeys.Add("FISPOSTED");
            e.FieldKeys.Add("FACCOUNTINGPERIOD");
            e.FieldKeys.Add("FORGID");
        }

        public override void BeforeExecuteOperationTransaction(BeforeExecuteOperationTransaction e)
        {
            base.BeforeExecuteOperationTransaction(e);

            foreach (DynamicObject voucher in e.SelectedRows)
            {
                // 1. 校验凭证已审核
                ValidateVoucherAudited(voucher);

                // 2. 校验凭证未记账
                ValidateVoucherNotPosted(voucher);

                // 3. 校验期间未结账
                ValidatePeriodNotClosed(voucher);
            }
        }

        private void ValidateVoucherAudited(DynamicObject voucher)
        {
            string documentStatus = voucher.GetVal<string>("FDOCUMENTSTATUS");

            if (documentStatus != "C")
            {
                throw new Exception("凭证未审核，不能记账");
            }
        }

        private void ValidateVoucherNotPosted(DynamicObject voucher)
        {
            bool isPosted = voucher.GetVal<bool>("FISPOSTED");

            if (isPosted)
            {
                throw new Exception("凭证已记账，不能重复记账");
            }
        }

        private void ValidatePeriodNotClosed(DynamicObject voucher)
        {
            string accountingPeriod = voucher.GetVal<string>("FACCOUNTINGPERIOD");
            long orgId = voucher.GetVal<long>("FORGID");

            string sql = $@"
                SELECT FIsClosed
                FROM T_GL_PeriodStatus
                WHERE FOrgId = {orgId} AND FPeriod = '{accountingPeriod}'";

            object result = DBUtils.ExecuteScalar(this.Context, sql, null);

            if (result != null && result.ToString() == "1")
            {
                throw new Exception(string.Format("会计期间{0}已结账，不能记账", accountingPeriod));
            }
        }
    }

    /// <summary>
    /// 凭证记账后处理插件
    /// </summary>
    public class VoucherAfterPostPlugin : AbstractOperationServicePlugIn
    {
        public override void AfterExecuteOperationTransaction(AfterExecuteOperationArgs e)
        {
            base.AfterExecuteOperationTransaction(e);

            foreach (DynamicObject voucher in e.SelectedRows)
            {
                // 更新记账信息
                UpdatePostInfo(voucher);

                // 更新总账余额
                UpdateGeneralLedger(voucher);

                // 更新辅助核算余额
                UpdateAuxiliaryBalance(voucher);

                // 更新现金流量
                UpdateCashFlow(voucher);

                // 记录操作日志
                LogOperation(voucher, "POST", "记账");
            }
        }

        private void UpdatePostInfo(DynamicObject voucher)
        {
            long voucherId = voucher.GetVal<long>("FID");
            long posterId = this.Context.UserId;

            string sql = $@"
                UPDATE VOUCHER.T_VOUCHER
                SET FISPOSTED = 1,
                    FPOSTINGSTATUS = 'B',
                    FDOCUMENTSTATUS = 'D',
                    FPOSTINGDATE = GETDATE(),
                    FPOSTERID = {posterId}
                WHERE FID = {voucherId}";

            DBUtils.Execute(this.Context, sql);
        }

        private void UpdateGeneralLedger(DynamicObject voucher)
        {
            long voucherId = voucher.GetVal<long>("FID");
            string accountingPeriod = voucher.GetVal<string>("FACCOUNTINGPERIOD");
            long orgId = voucher.GetVal<long>("FORGID");

            // 获取凭证明细
            string sql = $@"
                SELECT FACCOUNTID, FDEBITAMOUNT, FCREDITAMOUNT
                FROM VOUCHER.T_VOUCHERENTRY
                WHERE FID = {voucherId}";

            DataTable entries = DBUtils.ExecuteDataSet(this.Context, sql).Tables[0];

            foreach (DataRow entry in entries.Rows)
            {
                long accountId = Convert.ToInt64(entry["FACCOUNTID"]);
                decimal debitAmount = Convert.ToDecimal(entry["FDEBITAMOUNT"]);
                decimal creditAmount = Convert.ToDecimal(entry["FCREDITAMOUNT"]);

                // 更新总账余额（这里调用总账模块接口）
                // 实际实现需要调用总账模块的服务
                UpdateAccountBalance(orgId, accountId, accountingPeriod, debitAmount, creditAmount);
            }
        }

        private void UpdateAccountBalance(long orgId, long accountId, string period, decimal debit, decimal credit)
        {
            // 这里实现更新总账余额的逻辑
            // 实际项目中需要调用总账模块的接口
        }

        private void UpdateAuxiliaryBalance(DynamicObject voucher)
        {
            // 更新辅助核算余额的逻辑
            // 实际项目中需要调用辅助核算模块的接口
        }

        private void UpdateCashFlow(DynamicObject voucher)
        {
            // 更新现金流量的逻辑
            // 实际项目中需要调用现金流量模块的接口
        }

        private void LogOperation(DynamicObject voucher, string operationType, string operationName)
        {
            long voucherId = voucher.GetVal<long>("FID");
            string voucherNo = voucher.GetVal<string>("FVOUCHERNO");
            long operatorId = this.Context.UserId;

            string sql = $@"
                INSERT INTO VOUCHER.T_VOUCHERLOG 
                (FID, FVOUCHERNO, FOPERATIONTYPE, FOPERATIONNAME, FOPERATORID, FOPERATIONTIME, FOPERATIONRESULT)
                VALUES ({voucherId}, '{voucherNo}', '{operationType}', '{operationName}', {operatorId}, GETDATE(), 'SUCCESS')";

            DBUtils.Execute(this.Context, sql);
        }
    }

    /// <summary>
    /// 凭证反审核前校验插件
    /// </summary>
    public class VoucherBeforeUnAuditPlugin : AbstractOperationServicePlugIn
    {
        public override void BeforeExecuteOperationTransaction(BeforeExecuteOperationTransaction e)
        {
            base.BeforeExecuteOperationTransaction(e);

            foreach (DynamicObject voucher in e.SelectedRows)
            {
                // 校验凭证未记账
                bool isPosted = voucher.GetVal<bool>("FISPOSTED");

                if (isPosted)
                {
                    throw new Exception("凭证已记账，不能反审核");
                }
            }
        }
    }

    /// <summary>
    /// 凭证红冲插件
    /// </summary>
    public class VoucherRedCancelPlugin : AbstractOperationServicePlugIn
    {
        public override void OnPreparePropertys(PreparePropertysEventArgs e)
        {
            base.OnPreparePropertys(e);
            e.FieldKeys.Add("FID");
            e.FieldKeys.Add("FVOUCHERNO");
            e.FieldKeys.Add("FISPOSTED");
        }

        public override void BeforeExecuteOperationTransaction(BeforeExecuteOperationTransaction e)
        {
            base.BeforeExecuteOperationTransaction(e);

            foreach (DynamicObject voucher in e.SelectedRows)
            {
                // 校验凭证已记账
                bool isPosted = voucher.GetVal<bool>("FISPOSTED");

                if (!isPosted)
                {
                    throw new Exception("只有已记账的凭证才能红冲");
                }
            }
        }

        public override void AfterExecuteOperationTransaction(AfterExecuteOperationArgs e)
        {
            base.AfterExecuteOperationTransaction(e);

            foreach (DynamicObject voucher in e.SelectedRows)
            {
                // 创建红字凭证
                CreateRedVoucher(voucher);

                // 记录红冲关系
                RecordRedCancelRelation(voucher);
            }
        }

        private void CreateRedVoucher(DynamicObject originalVoucher)
        {
            // 实现创建红字凭证的逻辑
            // 复制原凭证，金额取反
        }

        private void RecordRedCancelRelation(DynamicObject originalVoucher)
        {
            // 记录红冲关系
        }
    }

    /// <summary>
    /// 凭证自动编码插件
    /// </summary>
    public class VoucherAutoNumberPlugin : AbstractOperationServicePlugIn
    {
        public override void OnPreparePropertys(PreparePropertysEventArgs e)
        {
            base.OnPreparePropertys(e);
            e.FieldKeys.Add("FVOUCHERNO");
            e.FieldKeys.Add("FVOUCHERTYPEID");
            e.FieldKeys.Add("FVOUCHERDATE");
            e.FieldKeys.Add("FPERIODYEAR");
            e.FieldKeys.Add("FPERIODNUMBER");
            e.FieldKeys.Add("FORGID");
        }

        public override void BeforeExecuteOperationTransaction(BeforeExecuteOperationTransaction e)
        {
            base.BeforeExecuteOperationTransaction(e);

            foreach (DynamicObject voucher in e.SelectedRows)
            {
                string voucherNo = voucher.GetVal<string>("FVOUCHERNO");

                // 如果凭证号为空，自动生成
                if (string.IsNullOrEmpty(voucherNo))
                {
                    GenerateVoucherNo(voucher);
                }
            }
        }

        private void GenerateVoucherNo(DynamicObject voucher)
        {
            long voucherTypeId = voucher.GetVal<long>("FVOUCHERTYPEID");
            DateTime voucherDate = voucher.GetVal<DateTime>("FVOUCHERDATE");
            long orgId = voucher.GetVal<long>("FORGID");

            int year = voucherDate.Year;
            int month = voucherDate.Month;

            // 获取凭证类型前缀
            string sql = $@"SELECT FPREFIX FROM VOUCHER.T_VOUCHERTYPE WHERE FTYPEID = {voucherTypeId}";
            string prefix = DBUtils.ExecuteScalar<string>(this.Context, sql, null);

            // 获取当前最大凭证号
            sql = $@"
                SELECT ISNULL(MAX(CAST(SUBSTRING(FVOUCHERNO, LEN('{prefix}') + 9, 4) AS INT)), 0)
                FROM VOUCHER.T_VOUCHER
                WHERE FVOUCHERTYPEID = {voucherTypeId}
                  AND FPERIODYEAR = {year}
                  AND FPERIODNUMBER = {month}
                  AND FORGID = {orgId}";

            int maxNo = DBUtils.ExecuteScalar<int>(this.Context, sql, 0);

            // 生成新凭证号
            string newVoucherNo = $"{prefix}-{year}{month:00}-{maxNo + 1:0000}";

            voucher["FVOUCHERNO"] = newVoucherNo;
            voucher["FPERIODYEAR"] = year;
            voucher["FPERIODNUMBER"] = month;
        }
    }
}
