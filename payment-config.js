// 支付配置文件
// 请根据实际情况修改以下配置

const paymentConfig = {
  // 服务器配置
  server: {
    url: '', // 使用相对路径，自动适配本地和生产环境
    apiKey: 'your-api-key' // API密钥（可选）
  },
  
  // 微信支付配置
  wechat: {
    appId: 'wx92fd4eb7a9df0364', // 微信公众号APPID
    mchId: '1105671520', // 微信支付商户号
    apiKey: 'a1b2c3D4e5f6g7h8i9j0k1l2m3n4o5p6', // 微信支付API密钥（商户平台设置）
    certPath: '', // 微信支付证书路径（可选，用于退款等高级功能）
    notifyUrl: 'https://zonya.work/api/wechat/notify' // 微信支付回调地址（使用HTTPS）
  },
  
  // 支付宝配置
  alipay: {
    appId: '2021006144613372', // 支付宝应用ID
    privateKey: `-----BEGIN PRIVATE KEY-----
MIIEvAIBADANBgkqhkiG9w0BAQEFAASCBKYwggSiAgEAAoIBAQCULKugNhHMXcF6gUoABoB6AxsCeC2hAJYdmk1dzc6vbFZULCTWwiz6kLE7CLbzoaVvMiy5IdyepCUNHn73CHgmBPhyQodRwpoISjCynxh3GUD79AmDvO/V59FZKbCCbRFzTY8HUc3kLIoBkt2cT2tnQ9g6jQZ9MeNXX6uBh3BLa1zTOxwukGOPffp0rKh+rP9GEFmeg6AoQOjtATttt94qvVCwWsFzVn+h0oi2W/2GlLAtjPUb0zqcDYns19ifXhmAkOalD4lXmsG06EDazfogq7gtI/xFdOaNghG+2ry1DmQHV4imgHRRZNBnWgvHbYKI5kgDi8ippDPGT+DJ9047AgMBAAECggEAT6+6WP3bEoo1XBmd32efvn5fDzPsbhKvqJnsE490IRllT/0xjqF8qQAZoELuiRWcr7FPJf0U9egW2PhWlanjW6b+qgwnVAwQ5HZpvBYdhSd6sEUsvMFmRiZWitoFyA65/MVwLyKKVLSzP2dpcP+xJibxaYOgQsIKnlmgFZfuB1CSdF3gs4Nvir04QP3NQcR1Wp5RyAu+1fxvg2jwqbgU+GlQXGrGdOmLgxhPl4BhAmd89PLJKYWNuDJVMMtRTEWnmyrNqyFbRezMTPrnX7gTuL6bU/xs1o+zAwkSpE8pDZ74jbmCxrnBjEnHFlJzqSFgI9iNSyq0tEE8VEoYfdIWEQKBgQDWenXT+/40Q6iHrgk9iDRGw/wXahWCkPT+rC2rIO/cFStJJMsiKjXQM6aMBMV562P9ullHistw9ymd1rItqKY8hSFrfeSirDfOnFu7jfdAg/pSt1ZyAPqumhsFUBYQQp8OWoJfV0nzXbxOK9BVxha2B0XmRjhlVf4Z0hCla93UwwKBgQCw3DFj/eyzjDYeFwW/nTLcLaa5FxT+eBdAYIGaO0VewUL389ddODufTuHYGhKgyPfUNu6Dw2AaI646YNN+74yu1ODOdThoessoE7l4uPz2v/CnMoBrDJ/6HnlgZw5QpV2wxKYmE1JsImr8EZ3f2H8YLrsnYT1lLeEer6BNWF8pKQKBgBeg3iJAfLzdR0/LSJFS1A+Hv9oEgeIkfhkgdteHhWVFn8MrHoXhCJSrXAnI7MiFujpVsUhEbi0/zYHqCS8miUnZkNj6wZl6R5undiOvfDHLWGSMdiWRHgzmRVvMeuHHtSYrqnk+cJMzHG+wO/93F0Fug7Dew4/GbXwCvHq8629pAoGAPtGXQXr5zjRpLHrk8dB2NjqI04ldTZ1+NMGShyOyWhuvG78iqdvFYap1EXsBTtbTIC96vJZy1hYCVn354UZY4+h9CRgdtw6Whl+rKzQZtdMrOVf4wQ007XRRjGpObVqvUpAmq7OFPR9kfLANMWsGiaJfm3cwhXWsVmfvOkm/UzECgYBtkyEWROS/5N/UL1no+jGNVeHoWct8G4usbS4yek35CXn4vzC/6FiJl88waibWbpmgV996LNvP+YdYDvrsY02PiMfXt/WGcCFnHr0q0CfjTAKW2HLCUVHUTCGjtqAOmVum2UY6y4RtT8Rlt22Zgz7bwH4+6z8Ou3QjUVQps3zkjg==
-----END PRIVATE KEY-----`, // 支付宝应用私钥（PKCS1格式）
    publicKey: `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAlSn3KRaaFHb2KmF/sAIojWWKeAt9tOY+mwo4tRODLjx5a6Lvfiafruf3lyxGv58YmjHh6IULQU/b0DaS6URpdbCJQuFvnv4EPqebnaKdiiQXtCaSGamINiZp9qWRKFqJs87v+aw7uT0sEMt/l6b/yEi1YziEL6CRF8JRc0UaOwDpOmlQs47Q3cGSRdPDXd2KRvLTiiPQgJ2iUVH2e3NtwSVCLj/g+m6VawY+5mZZ22vulQz/txi6iaBf9BM8RhrRSI1sE4eGl5Djh6ByVJGb0P1XW5u2/Vs6Mt1wBvfiYNVwSCPwPUG06fGtSkONLPgcinCY4fiYRTX/dTtyxwa5SwIDAQAB
-----END PUBLIC KEY-----`, // 支付宝公钥（从支付宝开放平台获取）
    notifyUrl: 'https://zonya.work/api/alipay/notify', // 支付宝回调地址（使用HTTPS）
    gatewayUrl: 'https://openapi.alipay.com/gateway.do' // 支付宝网关地址
  },
  
  // 云闪付配置
  unionpay: {
    merId: '请输入您的云闪付商户号', // 云闪付商户号
    certPath: '', // 云闪付证书路径
    certPassword: '', // 云闪付证书密码
    notifyUrl: 'https://zonya.work/api/unionpay/notify' // 云闪付回调地址（使用HTTPS）
  },
  
  // 对公账户信息（转账支付）
  companyAccount: {
    bankName: '招商银行长沙大河西先导区支行', // 银行名称
    accountName: '湖南驰雅互联网科技有限公司', // 账户名称
    accountNumber: '731912323510001', // 账户号码
    bankAddress: '招商银行长沙大河西先导区支行', // 开户地址
    contactPhone: '请填写联系电话' // 联系电话
  },
  
  // 支付方式
  paymentMethods: [
    {
      id: 'wechat',
      name: '微信支付',
      icon: '💳',
      enabled: true // 已启用微信支付
    },
    {
      id: 'alipay',
      name: '支付宝',
      icon: '💰',
      enabled: true
    },
    {
      id: 'unionpay',
      name: '云闪付',
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