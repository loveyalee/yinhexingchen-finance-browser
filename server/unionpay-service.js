// 银联卡在线支付服务（模拟版本）
// 正式环境需要申请银联商户号并配置证书

const crypto = require('crypto');

// 银联卡在线支付配置
const unionpayConfig = {
  merId: '777290058110097',  // 模拟商户号
  frontUrl: 'https://zonya.work/payment.html?status=unionpay_return',
  backUrl: 'https://zonya.work/api/unionpay/notify',
  gatewayUrl: 'https://gateway.95516.com',  // 正式网关
  // 沙箱网关: https://gateway.test.95516.com
};

// 存储订单状态
const unionpayOrders = new Map();

/**
 * 创建银联卡在线支付订单（模拟）
 * @param {Object} orderInfo - 订单信息
 */
async function createPayment(orderInfo) {
  const { orderId, amount, subject, body } = orderInfo;

  // 保存订单信息
  unionpayOrders.set(orderId, {
    orderId,
    amount,
    subject,
    body,
    status: 'pending',
    createTime: Date.now()
  });

  // 模拟生成支付二维码
  const qrCodeUrl = `unionpay://pay?orderId=${orderId}&amount=${amount}&merId=${unionpayConfig.merId}`;

  // 生成模拟支付链接
  const paymentUrl = `${unionpayConfig.frontUrl}&orderId=${orderId}&amount=${amount}`;

  return {
    success: true,
    data: {
      qrCodeUrl,
      paymentUrl,
      orderId,
      amount: amount.toFixed(2),
      merId: unionpayConfig.merId,
      // 模拟模式下返回支付二维码图片
      qrCodeImage: `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(qrCodeUrl)}`
    }
  };
}

/**
 * 查询银联卡在线支付订单状态
 * @param {string} orderId - 订单号
 */
async function queryPayment(orderId) {
  const localOrder = unionpayOrders.get(orderId);

  if (!localOrder) {
    return { success: false, message: '订单不存在' };
  }

  if (localOrder.status === 'paid') {
    return { success: true, data: localOrder };
  }

  // 模拟查询 - 返回待支付状态
  return {
    success: true,
    data: {
      ...localOrder,
      status: 'pending'
    }
  };
}

/**
 * 处理银联卡在线支付异步通知（模拟）
 * @param {Object} params - 回调参数
 */
async function handleNotify(params) {
  try {
    const { orderId, status } = params;

    if (!unionpayOrders.has(orderId)) {
      return { success: false, message: '订单不存在' };
    }

    if (status === 'success' || status === 'paid') {
      const order = unionpayOrders.get(orderId);
      unionpayOrders.set(orderId, {
        ...order,
        status: 'paid',
        transactionId: 'UP' + Date.now(),
        payTime: new Date().toISOString()
      });

      console.log(`银联卡在线支付订单 ${orderId} 支付成功`);
      return { success: true };
    }

    return { success: false, message: '支付未完成' };
  } catch (error) {
    console.error('处理银联卡在线支付回调失败:', error);
    return { success: false, message: error.message };
  }
}

/**
 * 模拟支付成功（用于测试）
 * @param {string} orderId - 订单号
 */
async function mockPaymentSuccess(orderId) {
  if (!unionpayOrders.has(orderId)) {
    return { success: false, message: '订单不存在' };
  }

  const order = unionpayOrders.get(orderId);
  unionpayOrders.set(orderId, {
    ...order,
    status: 'paid',
    transactionId: 'UP' + Date.now(),
    payTime: new Date().toISOString()
  });

  console.log(`[模拟] 银联卡在线支付订单 ${orderId} 支付成功`);
  return { success: true, message: '模拟支付成功' };
}

/**
 * 关闭银联卡在线支付订单
 * @param {string} orderId - 订单号
 */
async function closePayment(orderId) {
  if (!unionpayOrders.has(orderId)) {
    return { success: false, message: '订单不存在' };
  }

  const order = unionpayOrders.get(orderId);
  unionpayOrders.set(orderId, { ...order, status: 'closed' });

  return { success: true };
}

/**
 * 银联卡在线支付退款
 * @param {Object} refundInfo - 退款信息
 */
async function refund(refundInfo) {
  const { orderId, refundAmount, refundReason } = refundInfo;

  if (!unionpayOrders.has(orderId)) {
    return { success: false, message: '订单不存在' };
  }

  const order = unionpayOrders.get(orderId);
  unionpayOrders.set(orderId, { ...order, status: 'refunded' });

  return {
    success: true,
    data: {
      refundId: 'REFUND_' + Date.now(),
      refundAmount,
      refundReason
    }
  };
}

/**
 * 获取所有银联卡在线支付订单（调试用）
 */
function getAllOrders() {
  return Array.from(unionpayOrders.values());
}

module.exports = {
  createPayment,
  queryPayment,
  handleNotify,
  closePayment,
  refund,
  mockPaymentSuccess,
  getAllOrders,
  config: unionpayConfig
};
