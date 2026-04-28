const fs = require('fs');

const filePath = '/var/www/yinhexingchen/server.js';
let content = fs.readFileSync(filePath, 'utf8');

// 找到阿里云OCR函数的位置
const ocrFuncStart = content.indexOf('  // 阿里云 OCR API 调用');
if (ocrFuncStart === -1) {
  console.log('未找到OCR函数');
  process.exit(1);
}

// 找到函数结束位置（包括 }）
let braceCount = 0;
let funcStart = content.indexOf('\n  async function callAliyunOcr', ocrFuncStart);
let inFunc = false;
let funcEnd = -1;

for (let i = funcStart; i < content.length; i++) {
  if (content[i] === '{') {
    braceCount++;
    inFunc = true;
  } else if (content[i] === '}') {
    braceCount--;
    if (inFunc && braceCount === 0) {
      funcEnd = i + 1;
      break;
    }
  }
}

if (funcEnd === -1) {
  console.log('无法找到函数结束位置');
  process.exit(1);
}

// 提取函数体
const ocrFunc = content.substring(funcStart, funcEnd);

// 删除原位置的函数
content = content.substring(0, funcStart) + content.substring(funcEnd);

// 在createServer之前插入
const serverLine = content.indexOf("const server = http.createServer");
content = content.substring(0, serverLine) + '\n' + ocrFunc + '\n' + content.substring(serverLine);

// 删除不再需要的兼容函数
content = content.replace(/  \/\/ 兼容旧接口名称[\s\S]*?return await callAliyunOcr[\s\S]*?}[\s\S]*?/g, '');

// 写回文件
fs.writeFileSync(filePath, content);

console.log('修复完成');
