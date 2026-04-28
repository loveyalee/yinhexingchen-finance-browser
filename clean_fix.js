const fs = require('fs');
const filePath = '/var/www/yinhexingchen/server.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('开始彻底修复...');

// 找到所有 callAliyunOcr 函数的定义位置
const funcPattern = /  async function callAliyunOcr\(/g;
let match;
const funcPositions = [];
while ((match = funcPattern.exec(content)) !== null) {
  funcPositions.push(match.index);
}
console.log('找到', funcPositions.length, '个callAliyunOcr函数定义');

// 找到所有函数结束位置
function findMatchingBrace(start) {
  let count = 1;
  for (let i = start; i < content.length; i++) {
    if (content[i] === '{') count++;
    else if (content[i] === '}') {
      count--;
      if (count === 0) return i + 1;
    }
  }
  return -1;
}

// 保留第一个函数（带Action参数的版本），删除其他重复
funcPositions.shift(); // 移除第一个位置

for (const pos of funcPositions.sort((a, b) => b - a)) { // 从后往前删除
  const funcStart = content.lastIndexOf('\n  async function callAliyunOcr', pos);
  const funcEnd = findMatchingBrace(content.indexOf('{', pos));
  if (funcStart !== -1 && funcEnd !== -1) {
    const toRemove = content.substring(funcStart, funcEnd);
    if (!toRemove.includes('Action:')) { // 不删除带Action的版本
      content = content.substring(0, funcStart) + content.substring(funcEnd);
      console.log('删除重复函数');
    }
  }
}

// 确保没有 callTencentOcr 调用
content = content.replace(/callTencentOcr/g, 'callAliyunOcr');

// 删除兼容函数
content = content.replace(/\n  \/\/ 兼容旧接口名称\n[\s\S]*?return await callAliyunOcr[\s\S]*?\n  \}\n/g, '\n');

// 删除 callTencentOcrTable 函数
content = content.replace(/\n  \/\/ 腾讯云表格识别专用API\n[\s\S]*?async function callTencentOcrTable[\s\S]*?^  \}\n/g, '\n');

fs.writeFileSync(filePath, content);
console.log('修复完成');

// 验证
const check = fs.readFileSync(filePath, 'utf8');
const count = (check.match(/async function callAliyunOcr\(/g) || []).length;
console.log('最终callAliyunOcr函数数量:', count);
if (count !== 1) {
  console.log('警告: 函数数量异常');
  process.exit(1);
}
