const fs = require('fs');
const filePath = '/var/www/yinhexingchen/server.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('最小修复 + 移动函数...');

// 1. 替换所有 callTencentOcr 为 callAliyunOcr
content = content.replace(/callTencentOcr\(/g, 'callAliyunOcr(');
console.log('1. 替换函数调用');

// 2. 删除兼容wrapper函数
const compatStart = content.indexOf('\n  // 兼容旧接口名称\n');
if (compatStart !== -1) {
  let braceCount = 0;
  let started = false;
  let end = -1;
  for (let i = compatStart + 30; i < content.length; i++) {
    if (content[i] === '{') { braceCount++; started = true; }
    else if (content[i] === '}') { braceCount--; if (started && braceCount === 0) { end = i + 1; break; } }
  }
  if (end !== -1) {
    content = content.substring(0, compatStart) + content.substring(end);
    console.log('2. 删除兼容wrapper');
  }
}

// 3. 删除 callTencentOcrTable 函数
const tableStart = content.indexOf('\n  // 腾讯云表格识别专用API\n');
if (tableStart !== -1) {
  let braceCount = 0;
  let started = false;
  let end = -1;
  for (let i = tableStart + 30; i < content.length; i++) {
    if (content[i] === '{') { braceCount++; started = true; }
    else if (content[i] === '}') { braceCount--; if (started && braceCount === 0) { end = i + 1; break; } }
  }
  if (end !== -1) {
    content = content.substring(0, tableStart) + content.substring(end);
    console.log('3. 删除callTencentOcrTable');
  }
}

// 4. 添加 Action
if (!content.includes('let action = ')) {
  content = content.replace(
    /console\.log\(`OCR请求图片大小: \$\{imageSizeKB\}KB`\);/,
    `console.log('OCR请求图片大小: ' + imageSizeKB + 'KB, 类型: ' + apiType);
    
    // 根据 apiType 确定 Action
    let action = 'RecognizeBasicGeneral';
    if (apiType === 'table') {
      action = 'RecognizeTableOCR';
    }`
  );
  console.log('4a. 添加action变量');
}

if (!content.includes('Action: action')) {
  content = content.replace(
    /ImageBase64: imageData\n    \}/,
    `ImageBase64: imageData,
      Action: action
    }`
  );
  console.log('4b. 添加Action参数');
}

content = content.replace(/Version: '2021-07-07'/g, "Version: '2019-11-07'");
console.log('4c. 更新Version');

// 5. 移动函数到 createServer 之前
const createServerPos = content.indexOf('const server = http.createServer');
const funcStart = content.indexOf('\n  // 阿里云 OCR API 调用\n');

if (createServerPos !== -1 && funcStart !== -1) {
  // 找到函数结束
  let braceCount = 0;
  let started = false;
  let funcEnd = -1;
  for (let i = funcStart + 30; i < content.length; i++) {
    if (content[i] === '{') { braceCount++; started = true; }
    else if (content[i] === '}') { braceCount--; if (started && braceCount === 0) { funcEnd = i + 1; break; } }
  }
  
  if (funcEnd !== -1) {
    const func = content.substring(funcStart, funcEnd);
    content = content.substring(0, funcStart) + content.substring(funcEnd);
    content = content.substring(0, createServerPos) + '\n' + func + '\n' + content.substring(createServerPos);
    console.log('5. 移动函数到顶部');
  }
}

fs.writeFileSync(filePath, content);
console.log('完成');

// 验证
const check = fs.readFileSync(filePath, 'utf8');
const funcPos = check.indexOf('async function callAliyunOcr');
const serverPos = check.indexOf('http.createServer');
console.log('验证:');
console.log('  Action已添加:', check.includes('Action: action'));
console.log('  无callTencentOcr:', !check.includes('callTencentOcr('));
console.log('  函数位置:', funcPos, '< createServer:', funcPos < serverPos);
