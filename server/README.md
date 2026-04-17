# 支付宝支付配置说明

## 一、环境准备

### 1. 安装 Node.js
如果还没有安装 Node.js，请从官网下载安装：
- 下载地址：https://nodejs.org/
- 建议安装 LTS 版本

### 2. 安装依赖
```bash
cd server
npm install
```

## 二、支付宝开放平台配置

### 1. 登录支付宝开放平台
访问：https://open.alipay.com/

### 2. 创建应用
- 进入「控制台」->「我的应用」
- 点击「创建应用」
- 选择「网页/移动应用」

### 3. 配置应用
- 添加「电脑网站支付」或「手机网站支付」能力
- 配置应用公钥（需要使用支付宝密钥生成工具生成）

### 4. 密钥生成
- 下载支付宝密钥生成工具：https://opendocs.alipay.com/common/02kipk
- 生成 RSA2(SHA256) 密钥对
- 将「应用公钥」上传到支付宝开放平台
- 将「应用私钥」保存到服务器配置中

### 5. 配置回调地址
在支付宝开放平台配置：
- 授权回调地址：`https://zonya.work/api/alipay/notify`
- 前端返回地址：`https://zonya.work/payment.html?status=alipay_return`

## 三、服务器配置

### 1. 修改配置文件
编辑 `server/.env` 文件：

```env
# 支付宝配置
ALIPAY_APP_ID=你的应用ID
ALIPAY_NOTIFY_URL=https://zonya.work/api/alipay/notify
ALIPAY_RETURN_URL=https://zonya.work/payment.html?status=alipay_return

# 服务端口
PORT=3000
```

### 2. 修改私钥配置
编辑 `server/alipay-service.js`，将你的应用私钥填入：

```javascript
privateKey: `-----BEGIN PRIVATE KEY-----
你的应用私钥内容
-----END PRIVATE KEY-----`,
```

## 四、启动服务

### Windows
双击 `server/start.bat` 或在命令行运行：
```bash
cd server
npm start
```

### Linux/Mac
```bash
cd server
npm start
```

服务启动后访问：http://localhost:3000

## 五、测试支付

### 1. 本地测试
访问：http://localhost:3000/payment.html?amount=199&productName=黄金会员&type=membership

### 2. 沙箱环境测试
如需使用沙箱环境测试：
1. 在支付宝开放平台获取沙箱应用信息
2. 修改 `alipay-service.js` 中的网关地址：
   ```javascript
   gatewayUrl: 'https://openapi.alipaydev.com/gateway.do'
   ```
3. 使用沙箱账号进行测试

## 六、生产部署

### 1. 服务器要求
- Node.js 16+
- HTTPS 证书（支付宝要求）
- 域名已备案

### 2. 部署步骤
```bash
# 1. 上传代码到服务器
# 2. 安装依赖
cd server
npm install --production

# 3. 使用 PM2 管理进程
npm install -g pm2
pm2 start server.js --name payment-service

# 4. 设置开机自启
pm2 startup
pm2 save
```

### 3. Nginx 反向代理配置
```nginx
server {
    listen 443 ssl;
    server_name zonya.work;

    ssl_certificate /path/to/cert.pem;
    ssl_certificate_key /path/to/key.pem;

    location /api/ {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

## 七、常见问题

### Q: 支付时提示"签名错误"
A: 检查以下几点：
1. 应用私钥是否正确
2. 支付宝公钥是否正确（从开放平台获取）
3. 密钥格式是否正确（需要包含 BEGIN/END 标记）

### Q: 回调通知收不到
A: 检查以下几点：
1. 服务器是否使用 HTTPS
2. 回调地址是否可以从外网访问
3. 防火墙是否开放端口

### Q: 本地开发如何测试
A: 使用内网穿透工具（如 ngrok）将本地服务映射到公网：
```bash
ngrok http 3000
```
然后将生成的公网地址配置到支付宝回调地址中。

## 八、API 接口说明

### 创建支付
- URL: `/api/create_payment`
- Method: POST
- 参数:
  ```json
  {
    "orderId": "ORDER_123456",
    "amount": 19900,  // 单位：分
    "description": "黄金会员",
    "paymentMethod": "alipay"
  }
  ```

### 查询支付状态
- URL: `/api/query_payment`
- Method: POST
- 参数:
  ```json
  {
    "orderId": "ORDER_123456"
  }
  ```

### 支付回调
- URL: `/api/alipay/notify`
- Method: POST
- 说明: 由支付宝服务器调用，无需手动调用
