// 支付配置模板
// 请填写您的真实配置信息

const paymentConfig = {
  // 服务器配置
  server: {
    url: 'http://localhost:3000/api', // 本地开发时使用localhost，生产环境请使用真实域名
    apiKey: 'your-api-key' // API密钥（可选）
  },
  
  // 微信支付配置
  wechat: {
    appId: '请输入您的微信公众号APPID', // 微信公众号APPID
    mchId: '请输入您的微信支付商户号', // 微信支付商户号
    apiKey: '请输入您的微信支付API密钥', // 微信支付API密钥（商户平台设置）
    certPath: '', // 微信支付证书路径（可选，用于退款等高级功能）
    notifyUrl: 'http://your-domain.com/api/wechat/notify' // 微信支付回调地址（需要公网可访问）
  },
  
  // 支付宝配置
  alipay: {
    appId: '请输入您的支付宝应用ID', // 支付宝应用ID
    privateKey: `-----BEGIN PRIVATE KEY-----
请输入您的支付宝应用私钥（完整的PKCS1格式）
-----END PRIVATE KEY-----`, // 支付宝应用私钥（PKCS1格式）
    publicKey: `-----BEGIN PUBLIC KEY-----
请输入您的支付宝公钥（从支付宝开放平台获取）
-----END PUBLIC KEY-----`, // 支付宝公钥
    notifyUrl: 'http://your-domain.com/api/alipay/notify', // 支付宝回调地址（需要公网可访问）
    gatewayUrl: 'https://openapi.alipay.com/gateway.do' // 支付宝网关地址
  },
  
  // 银联卡在线支付配置（可选）
  unionpay: {
    merId: '请输入您的银联卡在线支付商户号', // 银联卡在线支付商户号
    certPath: '', // 银联卡在线支付证书路径
    certPassword: '', // 银联卡在线支付证书密码
    notifyUrl: 'http://your-domain.com/api/unionpay/notify' // 银联卡在线支付回调地址
  },
  
  // 对公账户信息（转账支付）
  companyAccount: {
    bankName: '请输入您的银行名称', // 银行名称
    accountName: '请输入您的公司名称', // 账户名称
    accountNumber: '请输入您的银行账号', // 账户号码
    bankAddress: '请输入您的开户支行地址', // 开户地址
    contactPhone: '请输入您的联系电话' // 联系电话
  },
  
  // 支付方式
  paymentMethods: [
    {
      id: 'wechat',
      name: '微信支付',
      icon: '💳',
      enabled: true // 已启用
    },
    {
      id: 'alipay',
      name: '支付宝',
      icon: '💰',
      enabled: true
    },
    {
      id: 'unionpay',
      name: '银联卡在线支付',
      icon: '💴',
      enabled: false // 如需启用请设置为true并配置unionpay信息
    },
    {
      id: 'transfer',
      name: '转账（对公账户）',
      icon: '🏦',
      enabled: true
    }
  ]
};

// 导出配置
if (typeof module !== 'undefined' && module.exports) {
  module.exports = paymentConfig;
} else if (typeof window !== 'undefined') {
  window.paymentConfig = paymentConfig;
}

/*
使用说明：
1. 复制此文件内容到 payment-config.js
2. 填写您的真实配置信息
3. 确保回调地址可以在公网访问
4. 保存后重启服务器

配置信息获取位置：
- 微信支付：微信商户平台 https://pay.weixin.qq.com
- 支付宝：支付宝开放平台 https://open.alipay.com
- 对公账户：您的企业银行账户信息
*/
