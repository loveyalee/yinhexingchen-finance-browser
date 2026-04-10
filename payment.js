// 支付处理模块

class PaymentProcessor {
  constructor() {
    // 支付配置
    this.config = {
      wechat: {
        appId: '', // 微信支付AppID
        mchId: '', // 微信支付商户号
        apiKey: ''  // 微信支付API密钥
      },
      alipay: {
        appId: '', // 支付宝应用ID
        privateKey: '', // 支付宝私钥
        publicKey: '' // 支付宝公钥
      },
      serverUrl: '' // 服务器端支付接口地址
    };
  }

  // 初始化支付配置
  init(config) {
    this.config = { ...this.config, ...config };
  }

  // 发起支付
  async createPayment(orderInfo) {
    try {
      const { amount, orderId, paymentMethod, description } = orderInfo;

      // 构建支付参数
      const paymentParams = {
        orderId,
        amount: amount * 100, // 转换为分
        description,
        paymentMethod,
        timestamp: Date.now(),
        nonce: Math.random().toString(36).substr(2, 9)
      };

      // 调用服务器端接口获取支付参数
      const response = await fetch(`${this.config.serverUrl}/api/create_payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(paymentParams)
      });

      const result = await response.json();

      if (result.success) {
        // 根据支付方式发起支付
        if (paymentMethod === 'wechat') {
          return this.wechatPay(result.data, orderId);
        } else if (paymentMethod === 'alipay') {
          return this.alipay(result.data);
        } else if (paymentMethod === 'unionpay') {
          return this.unionpay(result.data);
        } else if (paymentMethod === 'transfer') {
          return this.transfer(result.data, orderInfo);
        }
      } else {
        throw new Error(result.message || '创建支付失败');
      }
    } catch (error) {
      console.error('支付创建失败:', error);
      throw error;
    }
  }

  // 微信支付（扫码）
  wechatPay(payParams, orderId) {
    return new Promise((resolve, reject) => {
      if (!payParams || !payParams.code_url) {
        reject(new Error('未获取到微信支付二维码，请检查微信支付配置'));
        return;
      }

      // 更新状态标题
      const statusIcon = document.getElementById('status-icon');
      const statusTitle = document.getElementById('status-title');
      const statusMsg = document.getElementById('status-message');
      if (statusIcon) statusIcon.textContent = '📱';
      if (statusTitle) statusTitle.textContent = '微信扫码支付';
      if (statusMsg) statusMsg.textContent = '请使用微信扫描下方二维码，在两小时内完成支付';

      // 显示二维码
      const extraInfo = document.getElementById('payment-extra-info');
      if (extraInfo) {
        extraInfo.innerHTML = `<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(payParams.code_url)}" style="width:200px;height:200px;border:1px solid #eee;" alt="微信支付二维码">`;
        extraInfo.style.display = 'block';
      }

      // 显示"我已完成扫码支付"按钮
      const confirmBtn = document.getElementById('confirm-paid-button');
      if (confirmBtn) {
        confirmBtn.textContent = '我已完成扫码支付';
        confirmBtn.style.display = 'inline-block';
        confirmBtn.onclick = () => {
          clearInterval(pollInterval);
          resolve({ success: true });
        };
      }

      // 每3秒轮询支付状态
      const pollInterval = setInterval(async () => {
        try {
          const response = await fetch('/api/query_payment', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId })
          });
          const data = await response.json();
          if (data.success && data.data && data.data.status === 'paid') {
            clearInterval(pollInterval);
            if (confirmBtn) confirmBtn.style.display = 'none';
            resolve({ success: true, transactionId: data.data.transactionId });
          }
        } catch (e) { /* 继续轮询 */ }
      }, 3000);
    });
  }

  // 支付宝支付（跳转网关）
  alipay(payParams) {
    return new Promise((resolve, reject) => {
      const gatewayUrl = (window.paymentConfig && window.paymentConfig.alipay && window.paymentConfig.alipay.gatewayUrl)
        ? window.paymentConfig.alipay.gatewayUrl
        : 'https://openapi.alipay.com/gateway.do';

      // 构建表单并提交到支付宝网关（页面将跳转）
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = gatewayUrl;
      form.style.display = 'none';
      Object.keys(payParams).forEach(key => {
        const input = document.createElement('input');
        input.type = 'hidden';
        input.name = key;
        input.value = payParams[key];
        form.appendChild(input);
      });
      document.body.appendChild(form);
      form.submit();
      // 页面跳转到支付宝，Promise不会resolve
    });
  }
  
  // 云闪付支付
  unionpay(payParams) {
    return new Promise((resolve, reject) => {
      // 这里集成云闪付SDK
      // 实际项目中需要引入云闪付SDK
      console.log('发起云闪付支付:', payParams);
      
      // 模拟支付成功
      setTimeout(() => {
        resolve({ success: true, transactionId: 'UP' + Date.now() });
      }, 2000);
    });
  }
  
  // 转账支付（对公账户）
  transfer(_payParams, orderInfo) {
    return new Promise((resolve) => {
      const account = (window.paymentConfig && window.paymentConfig.companyAccount)
        ? window.paymentConfig.companyAccount
        : { bankName: '招商银行', accountName: '湖南驰雅互联网科技有限公司', accountNumber: '731912323510001', bankAddress: '招商银行长沙大河西先导区支行', contactPhone: '' };

      // 更新状态标题
      const statusIcon = document.getElementById('status-icon');
      const statusTitle = document.getElementById('status-title');
      const statusMsg = document.getElementById('status-message');
      if (statusIcon) statusIcon.textContent = '🏦';
      if (statusTitle) statusTitle.textContent = '银行转账';
      if (statusMsg) statusMsg.textContent = '请按以下账户信息完成转账，转账完成后点击确认';

      // 显示账户详情
      const extraInfo = document.getElementById('payment-extra-info');
      if (extraInfo) {
        const phone = (account.contactPhone && account.contactPhone !== '请填写联系电话')
          ? `<div><span style="color:#999">联系电话：</span>${account.contactPhone}</div>` : '';
        extraInfo.innerHTML = `
          <div style="text-align:left;background:#f8f9fa;padding:15px;border-radius:4px;font-size:14px;line-height:2.2;">
            <div><span style="color:#999">银行名称：</span><strong>${account.bankName}</strong></div>
            <div><span style="color:#999">账户名称：</span><strong>${account.accountName}</strong></div>
            <div><span style="color:#999">账户号码：</span><strong style="letter-spacing:1px;">${account.accountNumber}</strong></div>
            <div><span style="color:#999">开户行：</span>${account.bankAddress}</div>
            <div style="margin-top:8px;color:#e74c3c;font-weight:bold;font-size:16px;">转账金额：¥${orderInfo.amount.toFixed(2)}</div>
            <div><span style="color:#999">备注订单号：</span>${orderInfo.orderId}</div>
            ${phone}
          </div>`;
        extraInfo.style.display = 'block';
      }

      // 显示确认按钮
      const confirmBtn = document.getElementById('confirm-paid-button');
      if (confirmBtn) {
        confirmBtn.textContent = '我已完成转账';
        confirmBtn.style.display = 'inline-block';
        confirmBtn.onclick = () => {
          confirmBtn.style.display = 'none';
          resolve({ success: true, transactionId: 'TRANS' + Date.now() });
        };
      }
    });
  }

  // 查询支付状态
  async queryPayment(orderId) {
    try {
      const response = await fetch(`${this.config.serverUrl}/api/query_payment`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ orderId })
      });

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('查询支付状态失败:', error);
      throw error;
    }
  }

  // 处理支付回调
  handleCallback(data) {
    // 处理支付平台的回调通知
    console.log('支付回调:', data);
    // 验证签名
    // 更新订单状态
    // 返回成功响应
    return { success: true };
  }
}

// 导出单例
const paymentProcessor = new PaymentProcessor();
if (typeof module !== 'undefined' && module.exports) {
  module.exports = paymentProcessor;
} else if (typeof window !== 'undefined') {
  window.PaymentProcessor = PaymentProcessor; // 导出类本身
  window.paymentProcessor = paymentProcessor; // 也导出实例
}