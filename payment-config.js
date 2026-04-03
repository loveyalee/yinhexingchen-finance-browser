// 支付配置文件
// 请根据实际情况修改以下配置

const paymentConfig = {
  // 服务器配置
  server: {
    url: 'https://zonya.work/api', // 服务器API地址
    apiKey: 'your-api-key' // API密钥
  },
  
  // 微信支付配置
  wechat: {
    appId: 'your-wechat-app-id', // 微信公众号APPID
    mchId: '1634230959', // 微信支付商户号
    apiKey: 'your-wechat-api-key', // 微信支付API密钥
    notifyUrl: 'https://zonya.work/api/wechat/notify' // 微信支付回调地址
  },
  
  // 支付宝配置
  alipay: {
    appId: '2088051331903058', // 支付宝应用ID
    privateKey: 'your-alipay-private-key', // 支付宝私钥
    publicKey: 'your-alipay-public-key', // 支付宝公钥
    notifyUrl: 'https://zonya.work/api/alipay/notify' // 支付宝回调地址
  },
  
  // 支付方式
  paymentMethods: [
    {
      id: 'wechat',
      name: '微信支付',
      icon: '💳',
      enabled: true
    },
    {
      id: 'alipay',
      name: '支付宝',
      icon: '💰',
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