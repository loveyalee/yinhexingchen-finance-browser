// 服务器端支付处理
// 实际项目中，这应该是一个Node.js服务器

const http = require('http');
const url = require('url');
const querystring = require('querystring');

// 支付配置
const paymentConfig = {
  wechat: {
    appId: 'your-wechat-app-id',
    mchId: '1634230959',
    apiKey: 'your-wechat-api-key'
  },
  alipay: {
    appId: '2088051331903058',
    privateKey: 'your-alipay-private-key',
    publicKey: 'your-alipay-public-key'
  }
};

// 模拟订单数据
const orders = {};

// 创建服务器
const server = http.createServer((req, res) => {
  res.setHeader('Content-Type', 'application/json');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.statusCode = 200;
    res.end();
    return;
  }

  const parsedUrl = url.parse(req.url, true);
  const pathname = parsedUrl.pathname;

  if (pathname === '/api/create_payment' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        
        // 生成订单
        const orderId = data.orderId || 'ORDER_' + Date.now();
        orders[orderId] = {
          orderId,
          amount: data.amount,
          description: data.description,
          paymentMethod: data.paymentMethod,
          status: 'pending',
          createTime: new Date().toISOString()
        };

        // 生成支付参数
        let payParams = {};
        if (data.paymentMethod === 'wechat') {
          payParams = {
            appId: paymentConfig.wechat.appId,
            timeStamp: Math.floor(Date.now() / 1000).toString(),
            nonceStr: Math.random().toString(36).substr(2, 15),
            package: 'prepay_id=' + orderId,
            signType: 'MD5',
            paySign: 'simulated_sign'
          };
        } else if (data.paymentMethod === 'alipay') {
          payParams = {
            app_id: paymentConfig.alipay.appId,
            method: 'alipay.trade.page.pay',
            charset: 'UTF-8',
            sign_type: 'RSA2',
            timestamp: new Date().toISOString().replace(/T/, ' ').substr(0, 19),
            version: '1.0',
            notify_url: 'https://zonya.work/api/alipay/notify',
            biz_content: JSON.stringify({
              out_trade_no: orderId,
              product_code: 'FAST_INSTANT_TRADE_PAY',
              total_amount: (data.amount / 100).toFixed(2),
              subject: data.description
            }),
            sign: 'simulated_sign'
          };
        }

        res.statusCode = 200;
        res.end(JSON.stringify({
          success: true,
          data: payParams
        }));
      } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({
          success: false,
          message: 'Invalid request data'
        }));
      }
    });
  } else if (pathname === '/api/query_payment' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      try {
        const data = JSON.parse(body);
        const order = orders[data.orderId];

        if (order) {
          res.statusCode = 200;
          res.end(JSON.stringify({
            success: true,
            data: order
          }));
        } else {
          res.statusCode = 404;
          res.end(JSON.stringify({
            success: false,
            message: 'Order not found'
          }));
        }
      } catch (error) {
        res.statusCode = 400;
        res.end(JSON.stringify({
          success: false,
          message: 'Invalid request data'
        }));
      }
    });
  } else if (pathname === '/api/wechat/notify') {
    // 微信支付回调
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log('WeChat notify:', body);
      // 处理回调逻辑
      res.statusCode = 200;
      res.end('<xml><return_code><![CDATA[SUCCESS]]></return_code><return_msg><![CDATA[OK]]></return_msg></xml>');
    });
  } else if (pathname === '/api/alipay/notify') {
    // 支付宝支付回调
    let body = '';
    req.on('data', chunk => {
      body += chunk.toString();
    });
    req.on('end', () => {
      console.log('Alipay notify:', body);
      // 处理回调逻辑
      res.statusCode = 200;
      res.end('success');
    });
  } else {
    res.statusCode = 404;
    res.end(JSON.stringify({
      success: false,
      message: 'API not found'
    }));
  }
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
  console.log('API endpoints:');
  console.log('POST /api/create_payment - 创建支付');
  console.log('POST /api/query_payment - 查询支付状态');
  console.log('POST /api/wechat/notify - 微信支付回调');
  console.log('POST /api/alipay/notify - 支付宝回调');
});