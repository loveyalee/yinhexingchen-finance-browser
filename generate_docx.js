const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  AlignmentType, HeadingLevel, BorderStyle, WidthType, ShadingType,
  VerticalAlign, LevelFormat, PageNumber, Header, Footer,
  TableOfContents
} = require('docx');
const fs = require('fs');

// ==================== 辅助函数 ====================
function makeCell(text, opts = {}) {
  const {
    bold = false,
    shading = null,
    width = null,
    verticalAlign = VerticalAlign.CENTER,
  } = opts;
  const cellProps = {
    borders: {
      top: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
      bottom: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
      left: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
      right: { style: BorderStyle.SINGLE, size: 1, color: 'AAAAAA' },
    },
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
    verticalAlign,
    children: [new Paragraph({
      children: [new TextRun({ text: String(text), bold, font: 'Microsoft YaHei', size: 20 })],
    })],
  };
  if (shading) cellProps.shading = shading;
  if (width) cellProps.width = width;
  return new TableCell(cellProps);
}

function headerRow(texts, colWidths) {
  return new TableRow({
    tableHeader: true,
    children: texts.map((t, i) =>
      makeCell(t, {
        bold: true,
        width: colWidths ? { size: colWidths[i], type: WidthType.DXA } : undefined,
        shading: { fill: 'E8F0FE', type: ShadingType.CLEAR },
      })
    ),
  });
}

function dataRow(texts, colWidths, isEven = false) {
  return new TableRow({
    children: texts.map((t, i) =>
      makeCell(t, {
        width: colWidths ? { size: colWidths[i], type: WidthType.DXA } : undefined,
        shading: isEven ? { fill: 'F9F9F9', type: ShadingType.CLEAR } : undefined,
      })
    ),
  });
}

function makeTable(headers, rows, colWidths) {
  const totalWidth = colWidths ? colWidths.reduce((a, b) => a + b, 0) : 9026;
  return new Table({
    width: { size: totalWidth, type: WidthType.DXA },
    columnWidths: colWidths || headers.map(() => Math.floor(totalWidth / headers.length)),
    rows: [
      headerRow(headers, colWidths),
      ...rows.map((r, i) => dataRow(r, colWidths, i % 2 === 1)),
    ],
  });
}

function h1(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1,
    children: [new TextRun({ text, font: 'Microsoft YaHei', size: 32, bold: true, color: '2C3E50' })],
    spacing: { before: 360, after: 240 },
    border: {
      bottom: { style: BorderStyle.SINGLE, size: 12, color: '3498DB', space: 4 },
    },
    alignment: AlignmentType.CENTER,
  });
}

function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    children: [new TextRun({ text, font: 'Microsoft YaHei', size: 26, bold: true, color: '2C3E50' })],
    spacing: { before: 300, after: 180 },
    border: {
      left: { style: BorderStyle.SINGLE, size: 18, color: '3498DB', space: 6 },
    },
  });
}

function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    children: [new TextRun({ text, font: 'Microsoft YaHei', size: 22, bold: true, color: '34495E' })],
    spacing: { before: 200, after: 120 },
  });
}

function p(text, opts = {}) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Microsoft YaHei', size: 20, ...opts })],
    spacing: { before: 60, after: 120 },
  });
}

function pBold(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Microsoft YaHei', size: 20, bold: true })],
    spacing: { before: 60, after: 60 },
  });
}

function pItalic(text) {
  return new Paragraph({
    children: [new TextRun({ text, font: 'Microsoft YaHei', size: 20, italics: true, color: '555555' })],
    spacing: { before: 480, after: 120 },
  });
}

function codeBlock(lines) {
  return lines.map(line =>
    new Paragraph({
      children: [new TextRun({ text: line, font: 'Courier New', size: 18, color: '333333' })],
      shading: { fill: 'F4F4F4', type: ShadingType.CLEAR },
      spacing: { before: 0, after: 0 },
      border: {
        left: { style: BorderStyle.SINGLE, size: 12, color: '3498DB', space: 6 },
      },
      indent: { left: 300 },
    })
  );
}

// ==================== 构建文档 ====================
const doc = new Document({
  styles: {
    default: {
      document: { run: { font: 'Microsoft YaHei', size: 20, color: '333333' } },
    },
    paragraphStyles: [
      {
        id: 'Heading1', name: 'Heading 1', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 32, bold: true, font: 'Microsoft YaHei', color: '2C3E50' },
        paragraph: { spacing: { before: 360, after: 240 }, outlineLevel: 0 },
      },
      {
        id: 'Heading2', name: 'Heading 2', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 26, bold: true, font: 'Microsoft YaHei', color: '2C3E50' },
        paragraph: { spacing: { before: 300, after: 180 }, outlineLevel: 1 },
      },
      {
        id: 'Heading3', name: 'Heading 3', basedOn: 'Normal', next: 'Normal', quickFormat: true,
        run: { size: 22, bold: true, font: 'Microsoft YaHei', color: '34495E' },
        paragraph: { spacing: { before: 200, after: 120 }, outlineLevel: 2 },
      },
    ],
  },
  sections: [{
    properties: {
      page: {
        size: { width: 11906, height: 16838 },
        margin: { top: 1440, right: 1440, bottom: 1440, left: 1800 },
      },
    },
    headers: {
      default: new Header({
        children: [new Paragraph({
          children: [new TextRun({ text: '银河星辰财务专用浏览器网站建设方案', font: 'Microsoft YaHei', size: 18, color: '888888' })],
          alignment: AlignmentType.CENTER,
          border: { bottom: { style: BorderStyle.SINGLE, size: 4, color: 'DDDDDD', space: 4 } },
        })],
      }),
    },
    footers: {
      default: new Footer({
        children: [new Paragraph({
          children: [
            new TextRun({ text: '第 ', font: 'Microsoft YaHei', size: 18, color: '888888' }),
            new TextRun({ children: [PageNumber.CURRENT], font: 'Microsoft YaHei', size: 18, color: '888888' }),
            new TextRun({ text: ' 页', font: 'Microsoft YaHei', size: 18, color: '888888' }),
          ],
          alignment: AlignmentType.CENTER,
        })],
      }),
    },
    children: [
      // ---- 主标题 ----
      h1('银河星辰财务专用浏览器网站建设方案'),

      // ======= 一、网站内容及栏目介绍 =======
      h2('一、网站内容及栏目介绍'),

      h3('1. 网站概述'),
      p('银河星辰财务专用浏览器是一款专为财务人员设计的综合性财务管理工具，集成了会计核算、税务申报、数据分析、财务学习等多种功能，旨在提高财务工作效率，降低财务处理成本。'),

      h3('2. 网站栏目及内容介绍'),
      makeTable(
        ['栏目名称', '功能描述', '内容详情'],
        [
          ['仪表盘', '财务概览', '显示关键财务指标、待办事项、最近交易等'],
          ['财务软件', '软件集成', '集成银河星辰、金蝶KIS、用友U8等财务软件'],
          ['一键报税', '税务申报', '支持自动生成税务报表、在线申报'],
          ['数据分析', '数据可视化', '财务数据图表分析、趋势预测'],
          ['财务学堂', '学习资源', '财务课程、考试资料、行业资讯'],
          ['模板专区', '文档模板', '财务报表模板、合同模板、凭证模板'],
          ['在线商城', '财务用品', '财务软件、办公用品、专业书籍'],
          ['云盘', '文件存储', '安全存储财务文件、支持多设备同步'],
          ['智能财务助手', 'AI辅助', '智能问答、财务分析、流程自动化'],
          ['预算管理', '预算编制', '企业预算编制、执行跟踪、分析'],
          ['财务管理', '核心功能', '合同管理、发票管理、电子印章管理、风险预警'],
          ['审计专区', '审计工具', '审计工作底稿、审计流程管理'],
          ['财务BP', '业务伙伴', '财务分析、业务决策支持'],
          ['财务快聘', '人才招聘', '个人求职、企业招聘'],
          ['会计论坛', '交流平台', '专业讨论、问题解答、经验分享'],
          ['付费问答', '专家咨询', '向财务专家提问，获取专业解答'],
          ['行业头条', '行业资讯', '财务行业新闻、政策解读、市场动态'],
          ['我的会员', '个人中心', '会员信息、钱包管理、优惠券、积分商城'],
        ],
        [2200, 2200, 4626]
      ),

      h3('3. 网站截图'),
      pBold('仪表盘页面'),
      p('- 显示财务概览、关键指标、待办事项'),
      p('- 集成数据可视化图表，直观展示财务状况'),
      pBold('财务软件集成页面'),
      p('- 支持多种财务软件的集成与管理'),
      p('- 提供软件打开、详情查看功能'),
      pBold('一键报税页面'),
      p('- 税务申报表自动生成'),
      p('- 在线申报功能'),
      pBold('数据分析页面'),
      p('- 多维度财务数据图表'),
      p('- 趋势分析与预测'),

      h3('4. 多网站/域名用途'),
      makeTable(
        ['域名', '用途', '拓展使用情况'],
        [
          ['zonya.work', '主域名，财务浏览器应用', '已配置HTTPS，用于生产环境'],
          ['111.230.36.222', '服务器IP地址', '用于测试和开发环境'],
        ],
        [2200, 3500, 3326]
      ),

      // ======= 二、人员及资金安排 =======
      h2('二、人员及资金安排'),

      h3('1. 人员配置'),
      makeTable(
        ['角色', '职责', '资质要求', '能力要求', '背景'],
        [
          ['项目负责人', '整体规划、协调管理', '财务管理相关专业，5年以上项目管理经验', '熟悉财务软件系统，具备项目管理能力', '曾主导多个财务系统开发项目'],
          ['前端开发工程师', '网站前端开发', '计算机相关专业，3年以上前端开发经验', '精通HTML、CSS、JavaScript、React等', '有财务系统前端开发经验'],
          ['后端开发工程师', '服务器端开发', '计算机相关专业，3年以上后端开发经验', '精通Node.js、Express、MongoDB等', '有支付系统开发经验'],
          ['财务顾问', '业务需求分析', '财务相关专业，5年以上财务工作经验', '熟悉财务流程、税务法规', '注册会计师，曾在大型企业担任财务主管'],
          ['UI/UX设计师', '界面设计', '设计相关专业，2年以上UI设计经验', '精通设计工具，具备用户体验设计能力', '有财务软件界面设计经验'],
          ['测试工程师', '质量保证', '计算机相关专业，2年以上测试经验', '熟悉测试流程和工具', '有财务系统测试经验'],
          ['运维工程师', '服务器维护', '计算机相关专业，2年以上运维经验', '熟悉Linux、Nginx、SSL配置', '有云服务器管理经验'],
        ],
        [1500, 1500, 2200, 2200, 1626]
      ),

      h3('2. 资金安排'),
      makeTable(
        ['项目', '预算', '说明'],
        [
          ['服务器费用', '¥12,000/年', '云服务器租赁费用'],
          ['域名费用', '¥1,000/年', '域名注册和管理费用'],
          ['SSL证书', '¥500/年', 'HTTPS证书费用'],
          ['开发费用', '¥100,000', '前端、后端开发费用'],
          ['设计费用', '¥10,000', 'UI/UX设计费用'],
          ['测试费用', '¥8,000', '系统测试费用'],
          ['运维费用', '¥12,000/年', '服务器维护和技术支持'],
          ['其他费用', '¥5,000', '办公设备、软件许可等'],
          ['总计', '¥148,500', '首年总预算'],
        ],
        [3000, 2500, 3526]
      ),

      // ======= 三、内容管理制度 =======
      h2('三、内容管理制度'),

      h3('1. 设备配置'),
      makeTable(
        ['设备类型', '配置', '用途'],
        [
          ['服务器', '8核16GB内存，100GB SSD', '运行网站应用和数据库'],
          ['备份服务器', '4核8GB内存，500GB HDD', '数据备份和灾难恢复'],
          ['开发设备', '8核16GB内存，512GB SSD', '开发和测试环境'],
          ['网络设备', '千兆路由器，防火墙', '网络连接和安全防护'],
        ],
        [2200, 3500, 3326]
      ),

      h3('2. 组网结构'),
      ...codeBlock([
        '互联网 → 防火墙 → 负载均衡 → 应用服务器 → 数据库服务器',
        '                        ↓',
        '                  备份服务器',
      ]),

      h3('3. 使用技术'),
      makeTable(
        ['类别', '技术', '版本', '用途'],
        [
          ['前端', 'React', '18.x', '构建用户界面'],
          ['前端', 'Vite', '5.x', '前端构建工具'],
          ['前端', 'Ant Design', '5.x', 'UI组件库'],
          ['后端', 'Node.js', '16.x', '服务器端运行环境'],
          ['后端', 'Express', '4.x', 'Web框架'],
          ['数据库', 'MongoDB', '6.x', '数据存储'],
          ['部署', 'Nginx', '1.20.x', '反向代理和HTTPS'],
          ['安全', "Let's Encrypt", '-', 'SSL证书'],
        ],
        [1600, 2000, 1400, 4026]
      ),

      h3('4. 部署情况'),
      makeTable(
        ['环境', '配置', '用途'],
        [
          ['开发环境', '本地开发机', '代码开发和测试'],
          ['测试环境', '云服务器测试实例', '功能测试和性能测试'],
          ['生产环境', '云服务器生产实例', '正式上线运行'],
        ],
        [2200, 3500, 3326]
      ),

      // ======= 四、网站安全与信息安全管理制度 =======
      h2('四、网站安全与信息安全管理制度'),

      h3('1. 网络安全防御措施'),
      makeTable(
        ['措施', '描述', '实施方式'],
        [
          ['防火墙', '阻止未授权访问', '配置防火墙规则，只开放必要端口'],
          ['SSL加密', '保护数据传输', "使用Let's Encrypt SSL证书，强制HTTPS"],
          ['入侵检测', '监控可疑活动', '安装入侵检测系统，定期扫描'],
          ['DDoS防护', '防止分布式拒绝服务攻击', '配置DDoS防护服务'],
          ['定期备份', '防止数据丢失', '每日自动备份数据，异地存储'],
        ],
        [2000, 2500, 4526]
      ),

      h3('2. 信息安全管控制度'),
      makeTable(
        ['制度', '内容', '执行方式'],
        [
          ['数据加密', '敏感数据加密存储', '使用AES-256加密算法'],
          ['访问控制', '基于角色的权限管理', '实现细粒度的权限控制'],
          ['密码策略', '强密码要求', '密码复杂度检查，定期更换'],
          ['审计日志', '记录系统操作', '详细记录用户操作和系统事件'],
          ['安全培训', '提高安全意识', '定期对员工进行安全培训'],
        ],
        [2000, 2500, 4526]
      ),

      h3('3. 应急处理方案'),
      makeTable(
        ['事件类型', '应对措施', '责任人员'],
        [
          ['服务器故障', '启动备用服务器，恢复数据', '运维工程师'],
          ['数据泄露', '隔离受影响系统，通知用户，修复漏洞', '项目负责人、安全专家'],
          ['DDoS攻击', '启动DDoS防护，调整防火墙规则', '运维工程师'],
          ['系统入侵', '隔离系统，分析入侵途径，修复漏洞', '安全专家、运维工程师'],
          ['支付异常', '暂停支付功能，排查问题，恢复服务', '后端开发工程师、财务顾问'],
        ],
        [2000, 4000, 3026]
      ),

      // ======= 五、域名管理 =======
      h2('五、域名管理'),

      h3('1. 域名负责人'),
      makeTable(
        ['信息', '详情'],
        [
          ['负责人姓名', '[负责人姓名]'],
          ['联系电话', '[联系电话]'],
          ['邮箱', '[邮箱地址]'],
          ['职责', '负责域名的注册、续费、管理和争议处理'],
        ],
        [3500, 5526]
      ),

      h3('2. 域名有效期'),
      makeTable(
        ['域名', '注册日期', '到期日期', '续费方式'],
        [
          ['zonya.work', '2024-01-01', '2027-01-01', '自动续费'],
        ],
        [3000, 2000, 2000, 2026]
      ),

      h3('3. 域名过期处理措施'),
      makeTable(
        ['阶段', '处理措施', '责任人员'],
        [
          ['过期前30天', '发送续费提醒邮件', '域名负责人'],
          ['过期前7天', '电话通知负责人', '域名负责人'],
          ['过期当天', '尝试紧急续费', '域名负责人'],
          ['过期后30天', '联系域名注册商，尝试恢复', '域名负责人'],
          ['过期后60天', '评估域名恢复可能性，准备备用方案', '项目负责人、域名负责人'],
        ],
        [2000, 4500, 2526]
      ),

      h3('4. 域名安全措施'),
      makeTable(
        ['措施', '描述', '执行方式'],
        [
          ['域名锁定', '防止未授权转移', '在域名注册商处开启域名锁定'],
          ['隐私保护', '隐藏注册信息', '开启WHOIS隐私保护'],
          ['双因素认证', '增强账户安全', '为域名注册商账户开启双因素认证'],
          ['定期检查', '监控域名状态', '每月检查域名状态和到期日期'],
        ],
        [2000, 2500, 4526]
      ),

      // ---- 结语 ----
      pItalic('本方案基于银河星辰财务专用浏览器的功能需求和技术架构制定，旨在确保网站的安全、稳定、高效运行，为用户提供专业、便捷的财务管理工具。方案将根据实际开发过程中的需求变化进行适当调整。'),
    ],
  }],
});

Packer.toBuffer(doc).then(buffer => {
  fs.writeFileSync('网站建设方案.docx', buffer);
  console.log('Done: 网站建设方案.docx');
});
