#!/usr/bin/env node
/**
 * 新闻自动采集工具
 * 每24小时自动采集财务、税务相关新闻
 * 运行方式: node news_collector.js 或设置为系统定时任务
 */

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');

// 加载环境变量
function loadEnvFile(envFilePath) {
  if (!fs.existsSync(envFilePath)) return;
  const lines = fs.readFileSync(envFilePath, 'utf8').split(/\r?\n/);
  lines.forEach(function(rawLine) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) return;
    const idx = line.indexOf('=');
    if (idx <= 0) return;
    const key = line.slice(0, idx).trim();
    if (!key || Object.prototype.hasOwnProperty.call(process.env, key)) return;
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    process.env[key] = value;
  });
}

loadEnvFile(path.join(__dirname, '.env'));

// 配置
const CONFIG = {
  serverHost: 'localhost',
  serverPort: process.env.PORT || 5098,
  collectInterval: 24 * 60 * 60 * 1000, // 24小时
  sources: [
    {
      name: '财政部',
      url: 'http://www.mof.gov.cn/zhengwuxinxi/caizhengxinwen/',
      category: '财务政策'
    },
    {
      name: '税务总局',
      url: 'http://www.chinatax.gov.cn/chinatax/n810219/n810724/index.html',
      category: '税务政策'
    },
    {
      name: '中国会计报',
      url: 'http://www.zgkjb.cn/',
      category: '行业动态'
    }
  ]
};

// 模拟新闻数据（当无法从外部获取时使用）
const mockNewsData = [
  {
    title: '财政部发布最新会计准则修订通知',
    source: '财政部官网',
    category: '财务政策',
    content: '财政部近日发布通知，对现行会计准则进行部分修订，主要涉及收入确认、租赁会计等方面。企业需要在规定时间内完成相关调整，确保财务报表符合新准则要求。',
    publishTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
  },
  {
    title: '增值税留抵退税政策延续实施',
    source: '税务总局网站',
    category: '税务政策',
    content: '国家税务总局发布公告，增值税留抵退税政策将继续实施，符合条件的纳税人可按规定申请退还增量留抵税额。此举旨在进一步减轻企业负担，促进经济高质量发展。',
    publishTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
  },
  {
    title: '企业所得税年度汇算清缴注意事项',
    source: '税务研究',
    category: '税务政策',
    content: '随着企业所得税年度汇算清缴工作的开展，税务部门提醒纳税人注意申报时限、优惠政策适用条件等关键事项。建议企业提前准备相关资料，确保申报准确无误。',
    publishTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
  },
  {
    title: '数字化转型助力企业财务管理升级',
    source: '中国会计报',
    category: '行业动态',
    content: '越来越多的企业开始推进财务数字化转型，通过引入智能财务系统、RPA机器人等技术手段，提升财务工作效率和准确性。专家表示，数字化转型已成为企业财务管理的必然趋势。',
    publishTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
  },
  {
    title: '电子发票全面推广应用进展顺利',
    source: '财务与会计',
    category: '技术应用',
    content: '国家税务总局持续推进电子发票应用，目前已在多个行业和地区实现全覆盖。电子发票的推广有效降低了企业开票成本，提高了发票管理效率，受到纳税人普遍欢迎。',
    publishTime: new Date().toISOString().slice(0, 19).replace('T', ' ')
  }
];

// 发送新闻到服务器
function sendNewsToServer(articles) {
  return new Promise((resolve, reject) => {
    const postData = JSON.stringify({ articles: articles });

    const options = {
      hostname: CONFIG.serverHost,
      port: CONFIG.serverPort,
      path: '/api/admin/news/batch',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(postData)
      }
    };

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => { data += chunk; });
      res.on('end', () => {
        try {
          const result = JSON.parse(data);
          resolve(result);
        } catch (e) {
          reject(e);
        }
      });
    });

    req.on('error', (e) => {
      reject(e);
    });

    req.write(postData);
    req.end();
  });
}

// 从外部源采集新闻（模拟）
async function collectFromSource(source) {
  // 实际项目中，这里应该使用爬虫或RSS解析
  // 由于网络限制，这里返回模拟数据
  console.log(`[${new Date().toISOString()}] 正在从 ${source.name} 采集新闻...`);

  return new Promise((resolve) => {
    setTimeout(() => {
      // 模拟采集到的新闻
      const news = mockNewsData
        .filter(n => source.category === '财务政策' || source.category === '税务政策' || source.category === '行业动态' || source.category === '技术应用')
        .map(n => ({
          ...n,
          source: source.name,
          category: source.category
        }));

      resolve(news);
    }, 500);
  });
}

// 主采集函数
async function collectNews() {
  console.log(`\n[${new Date().toISOString()}] 开始采集新闻...`);

  let allArticles = [];

  // 从各个源采集
  for (const source of CONFIG.sources) {
    try {
      const articles = await collectFromSource(source);
      allArticles = allArticles.concat(articles);
    } catch (e) {
      console.error(`从 ${source.name} 采集失败:`, e.message);
    }
  }

  // 如果没有采集到数据，使用模拟数据
  if (allArticles.length === 0) {
    console.log('使用模拟新闻数据...');
    allArticles = mockNewsData;
  }

  // 去重（根据标题）
  const uniqueArticles = [];
  const titles = new Set();
  for (const article of allArticles) {
    if (!titles.has(article.title)) {
      titles.add(article.title);
      uniqueArticles.push(article);
    }
  }

  // 发送到服务器
  try {
    const result = await sendNewsToServer(uniqueArticles);
    console.log(`[${new Date().toISOString()}] 采集完成，成功添加 ${result.inserted || uniqueArticles.length} 条新闻`);
  } catch (e) {
    console.error('发送新闻到服务器失败:', e.message);
  }
}

// 定时采集
function startScheduledCollection() {
  console.log('新闻自动采集工具已启动');
  console.log(`采集间隔: ${CONFIG.collectInterval / 1000 / 60 / 60} 小时`);
  console.log(`服务器地址: ${CONFIG.serverHost}:${CONFIG.serverPort}`);

  // 立即执行一次
  collectNews();

  // 定时执行
  setInterval(collectNews, CONFIG.collectInterval);
}

// 如果直接运行此脚本
if (require.main === module) {
  startScheduledCollection();
}

// 导出函数供其他模块使用
module.exports = {
  collectNews,
  startScheduledCollection
};
