const fs = require('fs');
const filePath = '/var/www/yinhexingchen/server.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('添加Action参数...');

// 找到函数开始位置
const funcStart = content.indexOf('  async function callAliyunOcr(imageBase64, apiType) {');
if (funcStart === -1) {
  console.log('未找到函数');
  process.exit(1);
}

// 找到 Version: '2021-07-07' 所在行，在其后添加 Action
const versionLine = content.indexOf("Version: '2021-07-07'", funcStart);
if (versionLine !== -1) {
  // 在这行后添加 Action
  const insertPos = content.indexOf(',', versionLine) + 1;
  content = content.slice(0, insertPos) + "\n      Action: action," + content.slice(insertPos);
  console.log('添加Action字段');
}

// 添加 action 变量定义（在 imageSizeKB 之后）
const oldLogLine = "console.log(`OCR请求图片大小: ${imageSizeKB}KB`);";
const newLogLines = `console.log('OCR请求图片大小: ' + imageSizeKB + 'KB, 类型: ' + apiType);
    
    // 根据 apiType 确定 Action
    let action = 'RecognizeBasicGeneral';
    if (apiType === 'table') {
      action = 'RecognizeTableOCR';
    }`;

content = content.replace(oldLogLine, newLogLines);
console.log('添加action变量和日志');

// 替换 Version
content = content.replace(/Version: '2021-07-07'/g, "Version: '2019-11-07'");
console.log('更新Version');

// 添加 RegionId 默认值
content = content.replace(/RegionId: ALIYUN_REGION,/g, "RegionId: ALIYUN_REGION || 'cn-hangzhou',");
console.log('添加RegionId默认值');

// 替换 callTencentOcr 调用
content = content.replace(/callTencentOcr\(/g, 'callAliyunOcr(');
console.log('替换函数调用');

// 删除 callTencentOcrTable 函数
content = content.replace(/\n  \/\/ 腾讯云表格识别专用API\n[\s\S]*?async function callTencentOcrTable[\s\S]*?^  \}\n/g, '\n');
console.log('删除callTencentOcrTable函数');

// 删除兼容函数
content = content.replace(/\n  \/\/ 兼容旧接口名称\n[\s\S]*?async function callTencentOcr[\s\S]*?^  \}\n/g, '\n');
console.log('删除兼容函数');

fs.writeFileSync(filePath, content);
console.log('写入完成');

// 验证
const check = fs.readFileSync(filePath, 'utf8');
if (check.includes('Action: action')) {
  console.log('✓ Action已添加');
}
if (!check.includes('callTencentOcr(')) {
  console.log('✓ 无callTencentOcr调用');
}
