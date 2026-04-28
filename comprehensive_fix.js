const fs = require('fs');
const filePath = '/var/www/yinhexingchen/server.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('开始综合修复...');

// 1. 替换所有 callTencentOcr 为 callAliyunOcr
content = content.replace(/callTencentOcr/g, 'callAliyunOcr');
console.log('1. 替换callTencentOcr调用');

// 2. 删除 callTencentOcrTable 函数
const tableFuncRegex = /\n  \/\/ 腾讯云表格识别专用API\n  async function callTencentOcrTable[\s\S]*?\n  \}\n/g;
content = content.replace(tableFuncRegex, '\n');
console.log('2. 删除callTencentOcrTable');

// 3. 删除兼容函数 wrapper
const compatRegex = /\n  \/\/ 兼容旧接口名称\n  async function callTencentOcr[\s\S]*?return await callAliyunOcr[\s\S]*?\n  \}\n/g;
content = content.replace(compatRegex, '\n');
console.log('3. 删除兼容wrapper');

// 4. 找到 callAliyunOcr 函数并添加 Action
const funcMatch = content.match(/  async function callAliyunOcr\(imageBase64, apiType\) \{[\s\S]*?^  \}/m);
if (funcMatch) {
  let funcBody = funcMatch[0];
  
  // 添加 action 变量
  if (!funcBody.includes('let action =')) {
    funcBody = funcBody.replace(
      /console\.log\(`OCR请求图片大小: \$\{imageSizeKB\}KB`\);/,
      `console.log('OCR请求图片大小: ' + imageSizeKB + 'KB, 类型: ' + apiType);
    
    // 根据 apiType 确定 Action
    let action = 'RecognizeBasicGeneral';
    if (apiType === 'table') {
      action = 'RecognizeTableOCR';
    }`
    );
  }
  
  // 添加 Action 参数
  if (!funcBody.includes('Action: action')) {
    funcBody = funcBody.replace(
      /ImageBase64: imageData\n    \}/,
      `ImageBase64: imageData,
      Action: action
    }`
    );
  }
  
  // 更新 Version
  funcBody = funcBody.replace(/Version: '2021-07-07'/, "Version: '2019-11-07'");
  
  // 添加 RegionId 默认值
  funcBody = funcBody.replace(
    /RegionId: ALIYUN_REGION,/,
    "RegionId: ALIYUN_REGION || 'cn-hangzhou',"
  );
  
  content = content.replace(/  async function callAliyunOcr\(imageBase64, apiType\) \{[\s\S]*?^  \}/m, funcBody);
  console.log('4. 修改callAliyunOcr函数');
}

// 5. 移动函数到 createServer 之前
const createServerPos = content.indexOf('const server = http.createServer');
if (createServerPos !== -1) {
  // 找到函数开始
  const funcStart = content.indexOf('\n  // 阿里云 OCR API 调用');
  if (funcStart !== -1) {
    // 找到函数结束（找最后一个 }）
    let braceCount = 0;
    let inFunc = false;
    let funcEnd = -1;
    for (let i = funcStart + 1; i < content.length; i++) {
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
    
    if (funcEnd !== -1) {
      // 提取函数
      const func = content.substring(funcStart, funcEnd);
      // 删除原位置
      content = content.substring(0, funcStart) + content.substring(funcEnd);
      // 插入到 createServer 之前
      content = content.substring(0, createServerPos) + '\n' + func + '\n' + content.substring(createServerPos);
      console.log('5. 移动函数到顶部');
    }
  }
}

fs.writeFileSync(filePath, content);
console.log('写入完成');

// 验证
const check = fs.readFileSync(filePath, 'utf8');
const hasAction = check.includes('Action: action');
const hasNoCallTencent = !check.includes('callTencentOcr(');
const funcCount = (check.match(/async function callAliyunOcr\(/g) || []).length;

console.log('验证:');
console.log('  Action已添加:', hasAction);
console.log('  无callTencentOcr调用:', hasNoCallTencent);
console.log('  callAliyunOcr函数数量:', funcCount);

if (!hasAction || !hasNoCallTencent || funcCount !== 1) {
  console.log('警告: 验证未通过');
  process.exit(1);
}
console.log('修复成功');
