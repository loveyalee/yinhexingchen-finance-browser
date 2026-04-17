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

// 启动服务器
app.listen(PORT, () => {
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
});

module.exports = app;
