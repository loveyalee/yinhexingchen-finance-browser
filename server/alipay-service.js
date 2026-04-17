// 支付宝支付服务
const AlipaySdk = require('alipay-sdk').default;

// 支付宝配置 - 从环境变量或直接配置
const alipayConfig = {
  appId: process.env.ALIPAY_APP_ID || '2021006143648470',
  privateKey: process.env.ALIPAY_PRIVATE_KEY || `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCULKugNhHMXcF6gUoABoB6AxsCeC2hAJYdmk1dzc6vbFZULCTWwiz6kLE7CLbzoaVvMiy5IdyepCUNHn73CHgmBPhyQodRwpoISjCynxh3GUD79AmDvO/V59FZKbCCbRFzTY8HUc3kLIoBkt2cT2tnQ9g6jQZ9MeNXX6uBh3BLa1zTOxwukGOPffp0rKh+rP9GEFmeg6AoQOjtATttt94qvVCwWsFzVn+h0oi2W/2GlLAtjPUb0zqcDYns19ifXhmAkOalD4lXmsG06EDazfogq7gtI/xFdOaNghG+2ry1DmQHV4imgHRRZNBnWgvHbYKI5kgDi8ippDPGT+DJ9047AgMBAAECggEAT6+6WP3bEoo1XBmd32efvn5fDzPsbhKvqJnsE490IRllT/0xjqF8qQAZoELuiRWcr7FPJf0U9egW2PhWlanjW6b+qgwnVAwQ5HZpvBYdhSd6sEUsvMFmRiZWitoFyA65/MVwLyKKVLSzP2dpcP+xJibxaYOgQsIKnlmgFZfuB1CSdF3gs4Nvir04QP3NQcR1Wp5RyAu+1fxvg2jwqbgU+GlQXGrGdOmLgxhPl4BhAmd89PLJKYWNuDJVMMtRTEWnmyrNqyFbRezMTPrnX7gTuL6bU/xs1o+zAwkSpE8pDZ74jbmCxrnBjEnHFlJzqSFgI9iNSyq0tEE8VEoYfdIWEQKBgQDWenXT+/40Q6iHrgk9iDRGw/wXahWCkPT+rC2rIO/cFStJJMsiKjXQM6aMBMV562P9ullHistw9ymd1rItqKY8hSFrfeSirDfOnFu7jfdAg/pSt1ZyAPqumhsFUBYQQp8OWoJfV0nzXbxOK9BVxha2B0XmRjhlVf4Z0hCla93UwwKBgQCw3DFj/eyzjDYeFwW/nTLcLaa5FxT+eBdAYIGaO0VewUL389ddODufTuHYGhKgyPfUNu6Dw2AaI646YNN+74yu1ODOdThoessoE7l4uPz2v/CnMoBrDJ/6HnlgZw5QpV2wxKYmE1JsImr8EZ3f2H8YLrsnYT1lLeEer6BNWF8pKQKBgBeg3iJAfLzdR0/LSJFS1A+Hv9oEgeIkfhkgdteHhWVFn8MrHoXhCJSrXAnI7MiFujpVsUhEbi0/zYHqCS8miUnZkNj6wZl6R5undiOvfDHLWGSMdiWRHgzmRVvMeuHHtSYrqnk+cJMzHG+wO/93F0Fug7Dew4/GbXwCvHq8629pAoGAPtGXQXr5zjRpLHrk8dB2NjqI04ldTZ1+NMGShyOyWhuvG78iqdvFYap1EXsBTtbTIC96vJZy1hYCVn354UZY4+h9CRgdtw6Whl+rKzQZtdMrOVf4wQ007XRRjGpObVqvUpAmq7OFPR9kfLANMWsGiaJfm3cwhXWsVmfvOkm/UzECgYBtkyEWROS/5N/UL1no+jGNVeHoWct8G4usbS4yek35CXn4vzC/6FiJl88waibWbpmgV996LNvP+YdYDvrsY02PiMfXt/WGcCFnHr0q0CfjTAKW2HLCUVHUTCGjtqAOmVum2UY6y4RtT8Rlt22Zgz7bwH4+6z8Ou3QjUVQps3zkjg==
-----END PRIVATE KEY-----`,
  alipayPublicKey: process.env.ALIPAY_PUBLIC_KEY || `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlSn3KRaaFHb2KmF/sAIojWWKeAt9tOY+mwo4tRODLjx5a6Lvfiafruf3lyxGv58YmjHh6IULQU/b0DaS6URpdbCJQuFvnv4EPqebnaKdiiQXtCaSGamINiZp9qWRKFqJs87v+aw7uT0sEMt/l6b/yEi1YziEL6CRF8JRc0UaOwDpOmlQs47Q3cGSRdPDXd2KRvLTiiPQgJ2iUVH2e3NtwSVCLj/g+m6VawY+5mZZ22vulQz/txi6iaBf9BM8RhrRSI1sE4eGl5Djh6ByVJGb0P1XW5u2/Vs6Mt1wBvfiYNVwSCPwPUG06fGtSkONLPgcinCY4fiYRTX/dTtyxwa5SwIDAQAB
-----END PUBLIC KEY-----`,
  gatewayUrl: 'https://openapi.alipay.com/gateway.do',
  notifyUrl: process.env.ALIPAY_NOTIFY_URL || 'https://zonya.work/api/alipay/notify',
  returnUrl: process.env.ALIPAY_RETURN_URL || 'https://zonya.work/payment.html?status=alipay_return'
};

// 初始化支付宝SDK
const alipaySdk = new AlipaySdk({
  appId: alipayConfig.appId,
  privateKey: alipayConfig.privateKey,
  alipayPublicKey: alipayConfig.alipayPublicKey,
  gateway: alipayConfig.gatewayUrl
});

// 存储订单状态（生产环境应使用数据库）
const orders = new Map();

/**
 * 创建支付宝支付订单
 * @param {Object} orderInfo - 订单信息
 * @param {string} orderInfo.orderId - 订单号
 * @param {number} orderInfo.amount - 金额（元）
 * @param {string} orderInfo.subject - 商品名称
 * @param {string} orderInfo.body - 商品描述
 * @returns {Promise<Object>} - 支付参数
 */
async function createPayment(orderInfo) {
  const { orderId, amount, subject, body } = orderInfo;

  // 保存订单信息
  orders.set(orderId, {
    orderId,
    amount,
    subject,
    body,
    status: 'pending',
    createTime: Date.now()
  });

  // 构建请求参数
  const AlipayFormData = require('alipay-sdk/lib/form');
  const formData = new AlipayFormData();
  formData.setMethod('get');

  // 设置支付参数
  formData.addField('returnUrl', alipayConfig.returnUrl);
  formData.addField('notifyUrl', alipayConfig.notifyUrl);
  formData.addField('bizContent', {
    outTradeNo: orderId,
    productCode: 'FAST_INSTANT_TRADE_PAY',
    totalAmount: amount.toFixed(2),
    subject: subject,
    body: body || subject,
  });

  // 生成支付链接
  const result = await alipaySdk.exec(
    'alipay.trade.page.pay',
    {},
    { formData: formData }
  );

  return {
    success: true,
    data: {
      paymentUrl: result
    }
  };
}

/**
 * 创建手机网站支付订单
 * @param {Object} orderInfo - 订单信息
 */
async function createWapPayment(orderInfo) {
  const { orderId, amount, subject, body } = orderInfo;

  orders.set(orderId, {
    orderId,
    amount,
    subject,
    body,
    status: 'pending',
    createTime: Date.now()
  });

  const formData = new AlipayFormData();
  formData.setMethod('get');

  formData.addField('returnUrl', alipayConfig.returnUrl);
  formData.addField('notifyUrl', alipayConfig.notifyUrl);
  formData.addField('bizContent', {
    outTradeNo: orderId,
    productCode: 'QUICK_WAP_WAY',
    totalAmount: amount.toFixed(2),
    subject: subject,
    body: body || subject,
  });

  const result = await alipaySdk.exec(
    'alipay.trade.wap.pay',
    {},
    { formData: formData }
  );

  return {
    success: true,
    data: {
      paymentUrl: result
    }
  };
}

/**
 * 查询订单状态
 * @param {string} orderId - 订单号
 */
async function queryPayment(orderId) {
  // 先检查本地存储
  const localOrder = orders.get(orderId);
  if (localOrder && localOrder.status === 'paid') {
    return {
      success: true,
      data: localOrder
    };
  }

  // 查询支付宝订单状态
  try {
    const result = await alipaySdk.exec('alipay.trade.query', {
      bizContent: {
        outTradeNo: orderId
      }
    });

    if (result.code === '10000') {
      const tradeStatus = result.tradeStatus;
      const orderData = {
        orderId,
        transactionId: result.tradeNo,
        amount: parseFloat(result.totalAmount),
        status: tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED' ? 'paid' : 'pending',
        buyerId: result.buyerLogonId,
        payTime: result.sendPayDate
      };

      // 更新本地订单状态
      if (orders.has(orderId)) {
        const existingOrder = orders.get(orderId);
        orders.set(orderId, { ...existingOrder, ...orderData });
      } else {
        orders.set(orderId, orderData);
      }

      return {
        success: true,
        data: orderData
      };
    } else {
      return {
        success: false,
        message: result.msg || '查询失败'
      };
    }
  } catch (error) {
    console.error('查询支付宝订单失败:', error);
    return {
      success: false,
      message: error.message
    };
  }
}

/**
 * 处理支付宝异步通知
 * @param {Object} params - 支付宝回调参数
 */
async function handleNotify(params) {
  try {
    // 验证签名
    const signVerified = alipaySdk.checkNotifySign(params);

    if (!signVerified) {
      console.error('支付宝回调签名验证失败');
      return { success: false, message: '签名验证失败' };
    }

    const orderId = params.out_trade_no;
    const tradeStatus = params.trade_status;

    if (tradeStatus === 'TRADE_SUCCESS' || tradeStatus === 'TRADE_FINISHED') {
      // 更新订单状态
      if (orders.has(orderId)) {
        const order = orders.get(orderId);
        orders.set(orderId, {
          ...order,
          status: 'paid',
          transactionId: params.trade_no,
          buyerId: params.buyer_logon_id,
          payTime: params.gmt_payment
        });
      } else {
        orders.set(orderId, {
          orderId,
          status: 'paid',
          transactionId: params.trade_no,
          amount: parseFloat(params.total_amount),
          buyerId: params.buyer_logon_id,
          payTime: params.gmt_payment
        });
      }

      console.log(`订单 ${orderId} 支付成功`);
      return { success: true };
    }

    return { success: false, message: '支付未完成' };
  } catch (error) {
    console.error('处理支付宝回调失败:', error);
    return { success: false, message: error.message };
  }
}

/**
 * 关闭订单
 * @param {string} orderId - 订单号
 */
async function closePayment(orderId) {
  try {
    const result = await alipaySdk.exec('alipay.trade.close', {
      bizContent: {
        outTradeNo: orderId
      }
    });

    if (result.code === '10000') {
      if (orders.has(orderId)) {
        const order = orders.get(orderId);
        orders.set(orderId, { ...order, status: 'closed' });
      }
      return { success: true };
    } else {
      return { success: false, message: result.msg };
    }
  } catch (error) {
    console.error('关闭订单失败:', error);
    return { success: false, message: error.message };
  }
}

/**
 * 退款
 * @param {Object} refundInfo - 退款信息
 */
async function refund(refundInfo) {
  const { orderId, refundAmount, refundReason } = refundInfo;

  try {
    const result = await alipaySdk.exec('alipay.trade.refund', {
      bizContent: {
        outTradeNo: orderId,
        refundAmount: refundAmount.toFixed(2),
        refundReason: refundReason || '用户申请退款'
      }
    });

    if (result.code === '10000') {
      if (orders.has(orderId)) {
        const order = orders.get(orderId);
        orders.set(orderId, { ...order, status: 'refunded' });
      }
      return { success: true, data: result };
    } else {
      return { success: false, message: result.msg };
    }
  } catch (error) {
    console.error('退款失败:', error);
    return { success: false, message: error.message };
  }
}

module.exports = {
  createPayment,
  createWapPayment,
  queryPayment,
  handleNotify,
  closePayment,
  refund,
  orders
};
