// 支付服务主入口
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const alipayService = require('./alipay-service');
const unionpayService = require('./unionpay-service');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// 静态文件服务（用于本地开发）
app.use(express.static(path.join(__dirname, '..')));

// ==================== 用户数据库存储 ====================

// 用户数据文件路径
const USERS_DB_FILE = path.join(__dirname, 'data', 'users.json');

// 确保数据目录存在
const DATA_DIR = path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) {
  fs.mkdirSync(DATA_DIR, { recursive: true });
}

// 初始化用户数据库
function initUsersDB() {
  if (!fs.existsSync(USERS_DB_FILE)) {
    fs.writeFileSync(USERS_DB_FILE, JSON.stringify({ users: [] }, null, 2));
  }
}
initUsersDB();

// 读取用户数据
function readUsersDB() {
  try {
    const data = fs.readFileSync(USERS_DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取用户数据库失败:', error);
    return { users: [] };
  }
}

// 写入用户数据
function writeUsersDB(data) {
  try {
    fs.writeFileSync(USERS_DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('写入用户数据库失败:', error);
    return false;
  }
}

// ==================== 蜻蜓Chat账号管理 ====================

// 蜻蜓Chat账号数据文件路径
const CHAT_DB_FILE = path.join(__dirname, 'data', 'chat_accounts.json');

// 初始化蜻蜓Chat账号数据库
function initChatDB() {
  if (!fs.existsSync(CHAT_DB_FILE)) {
    fs.writeFileSync(CHAT_DB_FILE, JSON.stringify({ accounts: [] }, null, 2));
  }
}
initChatDB();

// 读取蜻蜓Chat账号数据
function readChatDB() {
  try {
    const data = fs.readFileSync(CHAT_DB_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('读取蜻蜓Chat数据库失败:', error);
    return { accounts: [] };
  }
}

// 写入蜻蜓Chat账号数据
function writeChatDB(data) {
  try {
    fs.writeFileSync(CHAT_DB_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (error) {
    console.error('写入蜻蜓Chat数据库失败:', error);
    return false;
  }
}

// 生成纯数字蜻蜓Chat账号ID
function generateChatId() {
  // 生成10位纯数字ID
  const timestamp = Date.now().toString().slice(-8);
  const random = Math.floor(Math.random() * 100).toString().padStart(2, '0');
  return timestamp + random;
}

// 创建蜻蜓Chat账号
function createChatAccount(user) {
  const chatDB = readChatDB();

  // 检查是否已有蜻蜓Chat账号
  const existingAccount = chatDB.accounts.find(a => a.userId === user.id);
  if (existingAccount) {
    return existingAccount;
  }

  // 生成纯数字账号ID
  let chatId = generateChatId();
  while (chatDB.accounts.find(a => a.chatId === chatId)) {
    chatId = generateChatId();
  }

  // 创建新账号
  const newChatAccount = {
    chatId: chatId,
    userId: user.id,
    username: user.username,
    phone: user.phone,
    password: user.password,
    nickname: user.username,
    avatar: null,
    createdAt: new Date().toISOString(),
    status: 'active'
  };

  chatDB.accounts.push(newChatAccount);
  writeChatDB(chatDB);

  return {
    chatId: newChatAccount.chatId,
    nickname: newChatAccount.nickname
  };
}

// ==================== 短信验证码 API ====================

// 验证码存储（临时）
const verificationCodes = new Map();

// 发送验证码
app.post('/api/sms/send-code', (req, res) => {
  try {
    const { phone, purpose } = req.body;

    if (!phone || !/^1[3-9]\d{9}$/.test(phone)) {
      return res.json({ success: false, message: '请输入正确的手机号码' });
    }

    // 生成6位验证码
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // 存储验证码，有效期5分钟
    verificationCodes.set(phone, {
      code,
      purpose,
      expires: Date.now() + 5 * 60 * 1000
    });

    console.log(`发送验证码到 ${phone}: ${code} (${purpose})`);

    // 返回成功（测试环境返回验证码）
    res.json({
      success: true,
      message: '验证码已发送',
      debugCode: code // 测试环境使用
    });
  } catch (error) {
    console.error('发送验证码失败:', error);
    res.json({ success: false, message: '发送验证码失败' });
  }
});

// ==================== 用户注册 API ====================

// 用户注册
app.post('/api/users/register', (req, res) => {
  try {
    const { username, phone, password, userType, institutionType, institutionName, creditCode, contactPerson } = req.body;

    console.log('用户注册请求:', { username, phone, userType });

    // 验证必填字段
    if (!phone || !password) {
      return res.json({ success: false, message: '手机号和密码为必填项' });
    }

    if (password.length < 6) {
      return res.json({ success: false, message: '密码长度至少6位' });
    }

    // 读取现有用户数据
    const db = readUsersDB();

    // 检查手机号是否已注册
    if (db.users.find(u => u.phone === phone)) {
      return res.json({ success: false, message: '该手机号已注册' });
    }

    // 检查用户名是否已存在（如果提供了用户名）
    if (username && db.users.find(u => u.username === username)) {
      return res.json({ success: false, message: '该用户名已被使用' });
    }

    // 创建新用户
    const newUser = {
      id: 'USER_' + Date.now(),
      username: username || phone, // 用户名默认为手机号
      phone,
      password, // 注意：实际生产环境应该加密存储
      userType,
      createdAt: new Date().toISOString(),
      status: 'active'
    };

    // 企业用户额外信息
    if (userType === 'enterprise') {
      const { enterpriseName, creditCode, legalPerson, address } = req.body;
      if (!enterpriseName || !creditCode) {
        return res.json({ success: false, message: '请选择企业信息' });
      }
      newUser.enterpriseName = enterpriseName;
      newUser.creditCode = creditCode;
      newUser.legalPerson = legalPerson || '';
      newUser.address = address || '';
      newUser.username = enterpriseName; // 企业用户名使用企业名称
    }

    // 第三方机构额外信息
    if (userType === 'institution') {
      if (!institutionType || !institutionName || !creditCode || !contactPerson) {
        return res.json({ success: false, message: '请填写所有机构信息' });
      }
      newUser.institutionType = institutionType;
      newUser.institutionName = institutionName;
      newUser.creditCode = creditCode;
      newUser.contactPerson = contactPerson;
    }

    // 保存到数据库
    db.users.push(newUser);
    writeUsersDB(db);

    console.log('用户注册成功:', newUser.id, newUser.username);

    // 同步注册蜻蜓Chat账号
    let chatAccount = null;
    if (req.body.syncChatAccount) {
      chatAccount = createChatAccount(newUser);
      console.log('同步创建蜻蜓Chat账号:', chatAccount.chatId);
    }

    res.json({
      success: true,
      message: '注册成功',
      data: {
        id: newUser.id,
        username: newUser.username,
        phone: newUser.phone,
        userType: newUser.userType,
        chatAccount: chatAccount // 返回蜻蜓Chat账号信息
      }
    });
  } catch (error) {
    console.error('用户注册失败:', error);
    res.json({ success: false, message: '注册失败：' + error.message });
  }
});

// 用户登录
app.post('/api/users/login', (req, res) => {
  try {
    const { account, password, userType } = req.body;

    console.log('用户登录请求:', { account, userType });

    if (!account || !password) {
      return res.json({ success: false, message: '请输入账号和密码' });
    }

    // 读取用户数据库
    const db = readUsersDB();

    // 查找用户（支持多种登录方式）
    const user = db.users.find(u => {
      const passwordMatch = u.password === password;
      if (!passwordMatch) return false;

      // 企业用户登录：支持企业名称、统一社会信用代码
      if (userType === 'enterprise') {
        return u.userType === 'enterprise' && (
          u.enterpriseName === account ||
          u.creditCode === account ||
          u.phone === account
        );
      }

      // 个人用户/其他：支持手机号、用户名、邮箱、身份证
      return u.phone === account ||
             u.username === account ||
             u.email === account ||
             u.idcard === account ||
             (u.enterpriseName === account && u.userType === 'enterprise') ||
             (u.creditCode === account && u.userType === 'enterprise');
    });

    if (!user) {
      return res.json({ success: false, message: '账号或密码错误，或用户类型不匹配' });
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return res.json({ success: false, message: '账号已被禁用' });
    }

    console.log('用户登录成功:', user.id, user.username);

    // 返回用户信息（不返回密码）
    res.json({
      success: true,
      message: '登录成功',
      data: {
        id: user.id,
        username: user.username,
        phone: user.phone,
        email: user.email || '',
        idcard: user.idcard || '',
        userType: user.userType,
        enterpriseName: user.enterpriseName || '',
        creditCode: user.creditCode || '',
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    console.error('用户登录失败:', error);
    res.json({ success: false, message: '登录失败：' + error.message });
  }
});

// 查询用户列表（调试用）
app.get('/api/users/list', (req, res) => {
  try {
    const db = readUsersDB();
    // 不返回密码
    const users = db.users.map(u => ({
      id: u.id,
      username: u.username,
      phone: u.phone,
      userType: u.userType,
      createdAt: u.createdAt,
      status: u.status
    }));
    res.json({ success: true, data: users });
  } catch (error) {
    res.json({ success: false, message: error.message });
  }
});

// ==================== 企业搜索 API ====================

// 企业数据模拟数据库（实际生产环境应调用天眼查/企查查API）
const enterpriseDatabase = [
  { name: '湖南驰雅互联网科技有限公司', creditCode: '91430100MA4R7G5X3K', legalPerson: '张三', address: '湖南省长沙市岳麓区' },
  { name: '湖南银河星辰科技有限公司', creditCode: '91430100MA4R7G5X4L', legalPerson: '李四', address: '湖南省长沙市开福区' },
  { name: '长沙智慧财务咨询有限公司', creditCode: '91430100MA4R7G5X5M', legalPerson: '王五', address: '湖南省长沙市雨花区' },
  { name: '湖南创新科技发展有限公司', creditCode: '91430100MA4R7G5X6N', legalPerson: '赵六', address: '湖南省长沙市天心区' },
  { name: '长沙云端数据服务有限公司', creditCode: '91430100MA4R7G5X7P', legalPerson: '钱七', address: '湖南省长沙市芙蓉区' },
  { name: '湖南智能制造科技有限公司', creditCode: '91430100MA4R7G5X8Q', legalPerson: '孙八', address: '湖南省长沙市望城区' },
  { name: '长沙金融信息服务有限公司', creditCode: '91430100MA4R7G5X9R', legalPerson: '周九', address: '湖南省长沙市岳麓区' },
  { name: '湖南大数据科技有限公司', creditCode: '91430100MA4R7G5Y0S', legalPerson: '吴十', address: '湖南省长沙市开福区' },
  { name: '腾讯科技（深圳）有限公司', creditCode: '9144030071526726XG', legalPerson: '马化腾', address: '深圳市南山区' },
  { name: '阿里巴巴（中国）有限公司', creditCode: '91330100799655058B', legalPerson: '张勇', address: '浙江省杭州市滨江区' },
  { name: '百度在线网络技术（北京）有限公司', creditCode: '91110108717809965C', legalPerson: '李彦宏', address: '北京市海淀区' },
  { name: '字节跳动有限公司', creditCode: '91110105MA0118XG3J', legalPerson: '张一鸣', address: '北京市海淀区' },
  { name: '华为技术有限公司', creditCode: '914403001922038216', legalPerson: '赵明', address: '深圳市龙岗区' },
  { name: '小米科技有限责任公司', creditCode: '91110108551385082Q', legalPerson: '雷军', address: '北京市海淀区' },
  { name: '京东世纪贸易有限公司', creditCode: '91110108671740739E', legalPerson: '刘强东', address: '北京市大兴区' },
  { name: '美团点评有限公司', creditCode: '91110105MA018MMP3M', legalPerson: '王兴', address: '北京市朝阳区' },
  { name: '网易（杭州）网络有限公司', creditCode: '91330108704284642L', legalPerson: '丁磊', address: '浙江省杭州市滨江区' },
  { name: '滴滴出行科技有限公司', creditCode: '91120116340903380H', legalPerson: '程维', address: '天津市武清区' },
  { name: '拼多多（上海）网络科技有限公司', creditCode: '91310115MA1K3M5P0K', legalPerson: '陈磊', address: '上海市长宁区' },
  { name: '快手科技有限公司', creditCode: '91110108580887538M', legalPerson: '宿华', address: '北京市海淀区' }
];

// 企业名称智能搜索
app.get('/api/enterprise/search', (req, res) => {
  try {
    const { keyword } = req.query;

    if (!keyword || keyword.length < 2) {
      return res.json({ success: true, data: [] });
    }

    console.log('企业搜索:', keyword);

    // 模糊搜索企业名称
    const results = enterpriseDatabase.filter(ent =>
      ent.name.toLowerCase().includes(keyword.toLowerCase())
    ).slice(0, 10); // 最多返回10条

    // 如果本地数据库没有结果，尝试调用外部API（这里模拟返回）
    if (results.length === 0) {
      // 模拟生成一些结果
      const mockResults = [
        {
          name: keyword + '有限公司',
          creditCode: generateCreditCode(),
          legalPerson: '待确认',
          address: '请核实实际地址'
        }
      ];
      return res.json({ success: true, data: mockResults, note: '未找到精确匹配，显示建议结果' });
    }

    res.json({ success: true, data: results });
  } catch (error) {
    console.error('企业搜索失败:', error);
    res.json({ success: false, message: '搜索失败：' + error.message });
  }
});

// 生成模拟的统一社会信用代码
function generateCreditCode() {
  const chars = '0123456789ABCDEFGHJKLMNPQRTUWXY';
  let code = '91'; // 登记管理部门代码（工商）
  code += '43'; // 机构类型（企业）
  code += '0100'; // 登记管理机关行政区划码（长沙市）
  code += 'MA'; // 组织机构代码前缀

  // 生成剩余的随机字符
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  // 计算校验码
  const weights = [1, 3, 9, 27, 19, 26, 16, 17, 20, 29, 25, 13, 8, 24, 10, 30, 28];
  let sum = 0;
  for (let i = 0; i < 17; i++) {
    const char = code.charAt(i);
    const value = chars.indexOf(char);
    sum += value * weights[i];
  }
  const checkCode = chars.charAt((31 - (sum % 31)) % 31);
  code += checkCode;

  return code;
}

// ==================== 通用支付路由 ====================

// 创建支付订单
app.post('/api/create_payment', async (req, res) => {
  try {
    const { orderId, amount, description, paymentMethod } = req.body;

    console.log('创建支付订单:', { orderId, amount, description, paymentMethod });

    if (paymentMethod === 'alipay') {
      // 支付宝支付 - 金额需要转换为元
      const result = await alipayService.createPayment({
        orderId,
        amount: amount / 100, // 前端传的是分，转换为元
        subject: description,
        body: description
      });

      if (result.success) {
        res.json({
          success: true,
          data: {
            paymentUrl: result.data.paymentUrl
          }
        });
      } else {
        res.json({
          success: false,
          message: result.message || '创建支付失败'
        });
      }
    } else if (paymentMethod === 'unionpay') {
      // 银联卡在线支付
      const result = await unionpayService.createPayment({
        orderId,
        amount: amount / 100,
        subject: description,
        body: description
      });

      if (result.success) {
        res.json({
          success: true,
          data: {
            qrCodeUrl: result.data.qrCodeUrl,
            qrCodeImage: result.data.qrCodeImage,
            orderId: result.data.orderId,
            amount: result.data.amount,
            method: 'unionpay'
          }
        });
      } else {
        res.json({
          success: false,
          message: result.message || '创建支付失败'
        });
      }
    } else if (paymentMethod === 'wechat') {
      // 微信支付 - 需要集成微信支付SDK
      res.json({
        success: true,
        data: {
          code_url: 'weixin://wxpay/bizpayurl?pr=mock_qr_code_' + orderId
        }
      });
    } else if (paymentMethod === 'transfer') {
      // 转账支付
      res.json({
        success: true,
        data: {
          method: 'transfer'
        }
      });
    } else {
      res.json({
        success: false,
        message: '不支持的支付方式'
      });
    }
  } catch (error) {
    console.error('创建支付订单失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 查询支付状态
app.post('/api/query_payment', async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;
    console.log('查询支付状态:', orderId, paymentMethod);

    let result;
    if (paymentMethod === 'unionpay') {
      result = await unionpayService.queryPayment(orderId);
    } else {
      result = await alipayService.queryPayment(orderId);
    }
    res.json(result);
  } catch (error) {
    console.error('查询支付状态失败:', error);
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 支付宝支付路由 ====================

// 支付宝异步通知
app.post('/api/alipay/notify', async (req, res) => {
  console.log('收到支付宝异步通知:', req.body);

  try {
    const result = await alipayService.handleNotify(req.body);

    if (result.success) {
      res.send('success');
    } else {
      res.send('fail');
    }
  } catch (error) {
    console.error('处理支付宝通知失败:', error);
    res.send('fail');
  }
});

// 支付宝同步返回
app.get('/api/alipay/return', (req, res) => {
  console.log('支付宝同步返回:', req.query);

  const params = new URLSearchParams({
    status: 'alipay_return',
    out_trade_no: req.query.out_trade_no || '',
    trade_no: req.query.trade_no || ''
  });

  res.redirect('/payment.html?' + params.toString());
});

// ==================== 银联卡在线支付路由 ====================

// 银联卡在线支付异步通知
app.post('/api/unionpay/notify', async (req, res) => {
  console.log('收到银联卡在线支付异步通知:', req.body);

  try {
    const result = await unionpayService.handleNotify(req.body);

    if (result.success) {
      res.json({ statusCode: '00', msg: 'success' });
    } else {
      res.json({ statusCode: '01', msg: 'fail' });
    }
  } catch (error) {
    console.error('处理银联卡在线支付通知失败:', error);
    res.json({ statusCode: '01', msg: error.message });
  }
});

// 银联卡在线支付同步返回
app.get('/api/unionpay/return', (req, res) => {
  console.log('银联卡在线支付同步返回:', req.query);

  const params = new URLSearchParams({
    status: 'unionpay_return',
    orderId: req.query.orderId || '',
    amount: req.query.amount || ''
  });

  res.redirect('/payment.html?' + params.toString());
});

// 银联卡在线支付模拟支付成功（测试用）
app.post('/api/unionpay/mock_success', async (req, res) => {
  try {
    const { orderId } = req.body;
    const result = await unionpayService.mockPaymentSuccess(orderId);
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// ==================== 通用路由 ====================

// 关闭订单
app.post('/api/close_payment', async (req, res) => {
  try {
    const { orderId, paymentMethod } = req.body;
    let result;
    if (paymentMethod === 'unionpay') {
      result = await unionpayService.closePayment(orderId);
    } else {
      result = await alipayService.closePayment(orderId);
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 退款
app.post('/api/refund', async (req, res) => {
  try {
    const { orderId, refundAmount, refundReason, paymentMethod } = req.body;
    let result;
    if (paymentMethod === 'unionpay') {
      result = await unionpayService.refund({ orderId, refundAmount, refundReason });
    } else {
      result = await alipayService.refund({ orderId, refundAmount, refundReason });
    }
    res.json(result);
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message
    });
  }
});

// 获取订单列表（调试用）
app.get('/api/orders', (req, res) => {
  const alipayOrders = Array.from(alipayService.orders.values());
  const unionpayOrders = unionpayService.getAllOrders();
  res.json({
    success: true,
    data: {
      alipay: alipayOrders,
      unionpay: unionpayOrders
    }
  });
});

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    message: '支付服务运行正常',
    timestamp: new Date().toISOString(),
    services: {
      alipay: 'enabled',
      unionpay: 'enabled (模拟模式)',
      wechat: 'disabled',
      transfer: 'enabled'
    }
  });
});

// ================================================================
// 费用报销 API
// ================================================================

// MySQL 连接配置（复用现有的阿里云RDS配置）
const mysql = require('mysql2/promise');
const multer = require('multer');
const uploadDir = path.join(__dirname, 'data', 'uploads', 'expenses');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

// 文件上传配置
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, uploadDir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    cb(null, uniqueSuffix + ext);
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
  fileFilter: (req, file, cb) => {
    const allowed = /jpeg|jpg|png|gif|webp/;
    const ext = allowed.test(path.extname(file.originalname).toLowerCase());
    const mime = allowed.test(file.mimetype);
    if (ext && mime) {
      cb(null, true);
    } else {
      cb(new Error('仅支持 JPG/PNG/GIF/WEBP 格式的图片'));
    }
  }
});

async function getExpenseConnection() {
  return await mysql.createConnection({
    host: process.env.MYSQL_HOST || 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
    port: parseInt(process.env.MYSQL_PORT) || 3306,
    database: process.env.MYSQL_DB || 'rds_dingding',
    user: process.env.MYSQL_USER || 'ram_dingding',
    password: process.env.MYSQL_PWD || 'h5J5BVEXtrjKVDSxmS4w',
    charset: 'utf8mb4',
    timezone: '+08:00'
  });
}

// 初始化数据库表
async function initExpenseTables() {
  const conn = await getExpenseConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS expense_reimbursements (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        expense_no VARCHAR(32) NOT NULL,
        user_id VARCHAR(64) NOT NULL,
        user_name VARCHAR(64) NOT NULL,
        expense_type VARCHAR(32) NOT NULL,
        amount DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        expense_date DATE NOT NULL,
        reason TEXT NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'draft',
        images JSON,
        reject_reason VARCHAR(256),
        paid_at DATETIME,
        paid_method VARCHAR(32),
        paid_account VARCHAR(64),
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_expense_no (expense_no),
        KEY idx_user_id (user_id),
        KEY idx_status (status),
        KEY idx_expense_date (expense_date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS expense_approvals (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        expense_id BIGINT UNSIGNED NOT NULL,
        approver_id VARCHAR(64) NOT NULL,
        approver_name VARCHAR(64) NOT NULL,
        approver_role VARCHAR(32),
        approval_level TINYINT UNSIGNED NOT NULL DEFAULT 1,
        status VARCHAR(16) NOT NULL,
        comment TEXT,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_expense_id (expense_id),
        KEY idx_approver_id (approver_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS expense_images (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        expense_id BIGINT UNSIGNED NOT NULL,
        file_name VARCHAR(255) NOT NULL,
        file_url VARCHAR(512) NOT NULL,
        file_size INT UNSIGNED DEFAULT 0,
        file_type VARCHAR(32),
        upload_user_id VARCHAR(64) NOT NULL,
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        KEY idx_expense_id (expense_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    console.log('[Expense] 数据库表初始化完成');
  } catch (error) {
    console.error('[Expense] 数据库表初始化失败:', error.message);
  } finally {
    await conn.end();
  }
}

// 生成报销单号
async function generateExpenseNo() {
  const conn = await getExpenseConnection();
  try {
    const yearMonth = new Date().toISOString().substring(0, 7).replace('-', '');
    const [rows] = await conn.query(
      "SELECT MAX(CAST(RIGHT(expense_no, 4) AS UNSIGNED)) as max_seq FROM expense_reimbursements WHERE LEFT(expense_no, 8) = ?",
      ['BX' + yearMonth]
    );
    const nextSeq = ((rows[0] && rows[0].max_seq) || 0) + 1;
    return 'BX' + yearMonth + String(nextSeq).padStart(4, '0');
  } finally {
    await conn.end();
  }
}

// GET /api/expenses — 获取报销列表
app.get('/api/expenses', async (req, res) => {
  try {
    const { userId, status, type, search, dateFrom, dateTo, page = 1, pageSize = 20 } = req.query;
    const conn = await getExpenseConnection();

    let where = [];
    let params = [];

    if (userId) {
      where.push('user_id = ?');
      params.push(userId);
    }
    if (status) {
      where.push('status = ?');
      params.push(status);
    }
    if (type) {
      where.push('expense_type = ?');
      params.push(type);
    }
    if (search) {
      where.push('(expense_no LIKE ? OR reason LIKE ? OR user_name LIKE ?)');
      params.push(`%${search}%`, `%${search}%`, `%${search}%`);
    }
    if (dateFrom) {
      where.push('expense_date >= ?');
      params.push(dateFrom);
    }
    if (dateTo) {
      where.push('expense_date <= ?');
      params.push(dateTo);
    }

    const whereClause = where.length ? 'WHERE ' + where.join(' AND ') : '';

    const offset = (parseInt(page) - 1) * parseInt(pageSize);

    const [rows] = await conn.query(
      `SELECT * FROM expense_reimbursements ${whereClause} ORDER BY created_at DESC LIMIT ? OFFSET ?`,
      [...params, parseInt(pageSize), offset]
    );

    const [countRows] = await conn.query(
      `SELECT COUNT(*) as total FROM expense_reimbursements ${whereClause}`,
      params
    );

    // 转换 images JSON 字段
    const data = rows.map(r => ({
      ...r,
      images: r.images ? JSON.parse(r.images) : []
    }));

    await conn.end();
    res.json({ success: true, data, total: countRows[0].total });
  } catch (error) {
    console.error('[Expense] GET /api/expenses error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// GET /api/expenses/:id — 获取报销详情
app.get('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await getExpenseConnection();

    const [rows] = await conn.query('SELECT * FROM expense_reimbursements WHERE id = ?', [id]);
    if (rows.length === 0) {
      await conn.end();
      return res.status(404).json({ success: false, message: '报销单不存在' });
    }

    const expense = rows[0];
    expense.images = expense.images ? JSON.parse(expense.images) : [];

    const [approvalRows] = await conn.query(
      'SELECT * FROM expense_approvals WHERE expense_id = ? ORDER BY created_at ASC',
      [id]
    );
    expense.approvals = approvalRows;

    await conn.end();
    res.json({ success: true, data: expense });
  } catch (error) {
    console.error('[Expense] GET /api/expenses/:id error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/expenses — 新建报销单
app.post('/api/expenses', async (req, res) => {
  try {
    const { userId, userName, expenseType, amount, expenseDate, reason, images } = req.body;

    if (!expenseType || !amount || !expenseDate || !reason) {
      return res.status(400).json({ success: false, message: '缺少必填字段' });
    }

    const expenseNo = await generateExpenseNo();
    const conn = await getExpenseConnection();

    const [result] = await conn.query(
      `INSERT INTO expense_reimbursements (expense_no, user_id, user_name, expense_type, amount, expense_date, reason, images, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending')`,
      [expenseNo, userId, userName || '匿名用户', expenseType, amount, expenseDate, reason, JSON.stringify(images || [])]
    );

    await conn.end();
    res.json({ success: true, message: '报销单创建成功', data: { id: result.insertId, expenseNo } });
  } catch (error) {
    console.error('[Expense] POST /api/expenses error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/expenses/:id — 更新报销单
app.put('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { expenseType, amount, expenseDate, reason, images } = req.body;
    const conn = await getExpenseConnection();

    const [rows] = await conn.query('SELECT * FROM expense_reimbursements WHERE id = ?', [id]);
    if (rows.length === 0) {
      await conn.end();
      return res.status(404).json({ success: false, message: '报销单不存在' });
    }

    await conn.query(
      `UPDATE expense_reimbursements SET expense_type=?, amount=?, expense_date=?, reason=?, images=?, status='pending', updated_at=NOW()
       WHERE id=?`,
      [expenseType, amount, expenseDate, reason, JSON.stringify(images || []), id]
    );

    await conn.end();
    res.json({ success: true, message: '报销单已更新' });
  } catch (error) {
    console.error('[Expense] PUT /api/expenses/:id error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// PUT /api/expenses/:id/status — 更新报销状态（审批）
app.put('/api/expenses/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, comment, approverId, approverName, approverRole } = req.body;

    if (!status) {
      return res.status(400).json({ success: false, message: '缺少状态参数' });
    }

    const conn = await getExpenseConnection();

    const [rows] = await conn.query('SELECT * FROM expense_reimbursements WHERE id = ?', [id]);
    if (rows.length === 0) {
      await conn.end();
      return res.status(404).json({ success: false, message: '报销单不存在' });
    }

    const expense = rows[0];
    const newStatus = status === 'rejected' ? 'rejected' : (status === 'approved' ? 'approved' : status);

    let updateFields = 'status = ?, updated_at = NOW()';
    let updateParams = [newStatus];

    if (status === 'rejected' && comment) {
      updateFields += ', reject_reason = ?';
      updateParams.push(comment);
    }

    if (status === 'approved') {
      updateFields += ', status = ?';
      updateParams[0] = 'approved';
    }

    if (status === 'paid') {
      updateFields += ', status = ?, paid_at = NOW()';
      updateParams[0] = 'paid';
    }

    updateParams.push(id);

    await conn.query(
      `UPDATE expense_reimbursements SET ${updateFields} WHERE id = ?`,
      updateParams
    );

    // 记录审批历史
    if (['approved', 'rejected'].includes(status)) {
      await conn.query(
        `INSERT INTO expense_approvals (expense_id, approver_id, approver_name, approver_role, status, comment)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [id, approverId, approverName, approverRole || '', status, comment || '']
      );
    }

    await conn.end();
    res.json({ success: true, message: `状态已更新为：${status}` });
  } catch (error) {
    console.error('[Expense] PUT /api/expenses/:id/status error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// DELETE /api/expenses/:id — 删除报销单
app.delete('/api/expenses/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const conn = await getExpenseConnection();

    const [rows] = await conn.query('SELECT status FROM expense_reimbursements WHERE id = ?', [id]);
    if (rows.length === 0) {
      await conn.end();
      return res.status(404).json({ success: false, message: '报销单不存在' });
    }

    if (!['draft', 'rejected'].includes(rows[0].status)) {
      await conn.end();
      return res.status(400).json({ success: false, message: '只能删除草稿或已驳回的报销单' });
    }

    await conn.query('DELETE FROM expense_approvals WHERE expense_id = ?', [id]);
    await conn.query('DELETE FROM expense_reimbursements WHERE id = ?', [id]);

    await conn.end();
    res.json({ success: true, message: '报销单已删除' });
  } catch (error) {
    console.error('[Expense] DELETE /api/expenses/:id error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// POST /api/expenses/upload — 上传附件图片
app.post('/api/expenses/upload', upload.single('image'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ success: false, message: '未检测到上传文件' });
    }

    const fileUrl = `/uploads/expenses/${req.file.filename}`;
    res.json({
      success: true,
      data: {
        url: fileUrl,
        name: req.file.originalname,
        size: req.file.size,
        type: req.file.mimetype
      }
    });
  } catch (error) {
    console.error('[Expense] Upload error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 静态文件：提供上传文件的访问
app.use('/uploads', express.static(path.join(__dirname, 'data', 'uploads')));

// GET /api/expenses/stats — 获取统计
app.get('/api/expenses/stats', async (req, res) => {
  try {
    const { userId } = req.query;
    const conn = await getExpenseConnection();

    let where = userId ? 'WHERE user_id = ?' : '';
    let params = userId ? [userId] : [];

    const [rows] = await conn.query(
      `SELECT status, COUNT(*) as count, COALESCE(SUM(amount), 0) as total_amount
       FROM expense_reimbursements ${where}
       GROUP BY status`,
      params
    );

    const [allRows] = await conn.query(
      `SELECT COUNT(*) as total, COALESCE(SUM(amount), 0) as total_amount
       FROM expense_reimbursements ${where}`,
      params
    );

    await conn.end();
    res.json({ success: true, data: { byStatus: rows, all: allRows[0] } });
  } catch (error) {
    console.error('[Expense] GET /api/expenses/stats error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// 启动服务器
app.listen(PORT, async () => {
  console.log(`=================================`);
  console.log(`银河星辰支付服务已启动`);
  console.log(`端口: ${PORT}`);
  console.log(`访问地址: http://localhost:${PORT}`);
  console.log(`=================================`);
  console.log(`支付方式:`);
  console.log(`  支付宝: 已启用`);
  console.log(`  银联卡在线支付: 已启用 (模拟模式)`);
  console.log(`  微信支付: 未配置`);
  console.log(`  转账支付: 已启用`);
  console.log(`=================================`);

  // 初始化费用报销数据库表
  await initExpenseTables();
  // 初始化送货单数据库表
  await initDeliveryNoteTables();
});

module.exports = app;

// ==================== 送货单数据库操作 ====================

// 初始化送货单数据库表
async function initDeliveryNoteTables() {
  const conn = await getExpenseConnection();
  try {
    await conn.query(`
      CREATE TABLE IF NOT EXISTS delivery_notes (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        no VARCHAR(32) NOT NULL,
        customer VARCHAR(255) NOT NULL,
        project_name VARCHAR(255),
        contact VARCHAR(64),
        contact_phone VARCHAR(32),
        address TEXT,
        remark TEXT,
        date DATE NOT NULL,
        status VARCHAR(16) NOT NULL DEFAULT 'draft',
        created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        UNIQUE KEY uk_no (no),
        KEY idx_customer (customer),
        KEY idx_status (status),
        KEY idx_date (date)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);

    await conn.query(`
      CREATE TABLE IF NOT EXISTS delivery_note_items (
        id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT PRIMARY KEY,
        delivery_note_id BIGINT UNSIGNED NOT NULL,
        product_name VARCHAR(255) NOT NULL,
        model VARCHAR(64),
        length VARCHAR(32),
        wattage VARCHAR(32),
        brightness VARCHAR(32),
        sensor VARCHAR(32),
        quantity DECIMAL(10,2) NOT NULL DEFAULT 0,
        unit VARCHAR(16),
        price DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        subtotal DECIMAL(12,2) NOT NULL DEFAULT 0.00,
        KEY idx_delivery_note_id (delivery_note_id)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
    `);
    console.log('[DeliveryNote] Tables initialized successfully');
  } catch (error) {
    console.error('[DeliveryNote] initDeliveryNoteTables error:', error);
  } finally {
    await conn.end();
  }
}

// GET /api/delivery-notes — 获取送货单列表
app.get('/api/delivery-notes', async (req, res) => {
  const conn = await getExpenseConnection();
  try {
    const userId = req.query.userId;
    let query = 'SELECT * FROM delivery_notes';
    let params = [];
    
    if (userId) {
      query += ' WHERE user_id = ?';
      params.push(userId);
    }
    
    query += ' ORDER BY date DESC';
    
    const [notes] = await conn.query(query, params);
    
    const result = await Promise.all(notes.map(async (note) => {
      const [items] = await conn.query(`
        SELECT * FROM delivery_note_items WHERE delivery_note_id = ?
      `, [note.id]);
      return { ...note, items };
    }));
    
    res.json({ success: true, data: result });
  } catch (error) {
    console.error('[DeliveryNote] GET /api/delivery-notes error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await conn.end();
  }
});

// GET /api/delivery-notes/:no — 获取单个送货单
app.get('/api/delivery-notes/:no', async (req, res) => {
  const conn = await getExpenseConnection();
  try {
    const [notes] = await conn.query(`
      SELECT * FROM delivery_notes WHERE no = ?
    `, [req.params.no]);
    
    if (notes.length === 0) {
      return res.status(404).json({ success: false, message: '送货单不存在' });
    }
    
    const note = notes[0];
    const [items] = await conn.query(`
      SELECT * FROM delivery_note_items WHERE delivery_note_id = ?
    `, [note.id]);
    
    res.json({ success: true, data: { ...note, items } });
  } catch (error) {
    console.error('[DeliveryNote] GET /api/delivery-notes/:no error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await conn.end();
  }
});

// POST /api/delivery-notes — 创建送货单
app.post('/api/delivery-notes', async (req, res) => {
  const conn = await getExpenseConnection();
  try {
    const { no, customer, project_name, projectName, contact, contactPhone, contact_phone, address, remark, date, status, items } = req.body;
    
    const [result] = await conn.query(`
      INSERT INTO delivery_notes (no, customer, project_name, contact, contact_phone, address, remark, date, status)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [no, customer, project_name || projectName || '', contact || '', contactPhone || contact_phone || '', address || '', remark || '', date, status || 'draft']);
    
    const noteId = result.insertId;
    
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await conn.query(`
          INSERT INTO delivery_note_items (delivery_note_id, product_name, model, length, wattage, brightness, sensor, quantity, unit, price, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [noteId, item.product_name || item.product || '', item.model || '', item.length || '', item.wattage || '', item.brightness || '', item.sensor || '', item.quantity || 0, item.unit || '个', item.price || 0, item.subtotal || (item.quantity * item.price)]);
      }
    }
    
    console.log(`[DeliveryNote] Created delivery note: ${no}`);
    res.json({ success: true, id: noteId, no });
  } catch (error) {
    console.error('[DeliveryNote] POST /api/delivery-notes error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await conn.end();
  }
});

// PUT /api/delivery-notes — 更新送货单
app.put('/api/delivery-notes', async (req, res) => {
  const conn = await getExpenseConnection();
  try {
    const { no, customer, project_name, projectName, contact, contactPhone, contact_phone, address, remark, date, status, items } = req.body;
    
    await conn.query(`
      UPDATE delivery_notes 
      SET customer = ?, project_name = ?, contact = ?, contact_phone = ?, address = ?, remark = ?, date = ?, status = ?
      WHERE no = ?
    `, [customer, project_name || projectName || '', contact || '', contactPhone || contact_phone || '', address || '', remark || '', date, status, no]);
    
    const [notes] = await conn.query(`SELECT id FROM delivery_notes WHERE no = ?`, [no]);
    if (notes.length === 0) {
      return res.status(404).json({ success: false, message: '送货单不存在' });
    }
    const noteId = notes[0].id;
    
    // 删除原有商品项
    await conn.query(`DELETE FROM delivery_note_items WHERE delivery_note_id = ?`, [noteId]);
    
    // 添加新商品项
    if (items && Array.isArray(items)) {
      for (const item of items) {
        await conn.query(`
          INSERT INTO delivery_note_items (delivery_note_id, product_name, model, length, wattage, brightness, sensor, quantity, unit, price, subtotal)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `, [noteId, item.product_name || item.product || '', item.model || '', item.length || '', item.wattage || '', item.brightness || '', item.sensor || '', item.quantity || 0, item.unit || '个', item.price || 0, item.subtotal || (item.quantity * item.price)]);
      }
    }
    
    console.log(`[DeliveryNote] Updated delivery note: ${no}`);
    res.json({ success: true, no });
  } catch (error) {
    console.error('[DeliveryNote] PUT /api/delivery-notes error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await conn.end();
  }
});

// DELETE /api/delivery-notes — 删除送货单
app.delete('/api/delivery-notes', async (req, res) => {
  const conn = await getExpenseConnection();
  try {
    const { id, no } = req.body;
    
    let noteId = id;
    if (no) {
      const [notes] = await conn.query(`SELECT id FROM delivery_notes WHERE no = ?`, [no]);
      if (notes.length === 0) {
        return res.status(404).json({ success: false, message: '送货单不存在' });
      }
      noteId = notes[0].id;
    }
    
    await conn.query(`DELETE FROM delivery_note_items WHERE delivery_note_id = ?`, [noteId]);
    await conn.query(`DELETE FROM delivery_notes WHERE id = ?`, [noteId]);
    
    console.log(`[DeliveryNote] Deleted delivery note: ${no || id}`);
    res.json({ success: true });
  } catch (error) {
    console.error('[DeliveryNote] DELETE /api/delivery-notes error:', error);
    res.status(500).json({ success: false, message: error.message });
  } finally {
    await conn.end();
  }
});
