const fs = require('fs');
const filePath = '/var/www/yinhexingchen/server.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('移动OCR函数到createServer之前...');

// 找到 createServer 行
const serverLine = content.indexOf('const server = http.createServer');
if (serverLine === -1) {
  console.log('未找到createServer');
  process.exit(1);
}

// 找到 OCR API 注释开始（函数组）
const ocrComment = '  // ==================== OCR 工具箱 API';
const ocrStart = content.indexOf(ocrComment);
if (ocrStart === -1) {
  console.log('未找到OCR注释');
  process.exit(1);
}

// 找到 compressBase64Image 函数开始
const compressFunc = '  // 压缩过大的 base64 图片';
const compressStart = content.indexOf(compressFunc);
if (compressStart === -1) {
  console.log('未找到compressBase64Image');
  process.exit(1);
}

// 找到 callAliyunOcr 函数开始
const aliyunFunc = '  // 阿里云 OCR API 调用';
const aliyunStart = content.indexOf(aliyunFunc);
if (aliyunStart === -1) {
  console.log('未找到callAliyunOcr');
  process.exit(1);
}

// 找到 callAliyunOcrTable 函数开始
const tableStart = content.indexOf('  async function callAliyunOcrTable');

// 找到所有 OCR API 结束位置（在最后一个 else if 之前）
const ocrEndMatch = content.substring(tableStart).match(/\n\n  \} else if \(pathname === '\/api\/ocr/);
let ocrEnd;
if (ocrEndMatch) {
  ocrEnd = tableStart + ocrEndMatch.index + ocrEndMatch[0].length - 2;
} else {
  // 找不到，使用 tableStart 后的内容
  console.log('使用备选方法确定结束位置');
  // 找到 api/ocr/test 路由
  const testRoute = content.indexOf("/api/ocr/test");
  if (testRoute !== -1) {
    // 向前找最近的 }
    ocrEnd = content.lastIndexOf('}', testRoute);
  }
}

// 提取 OCR 函数（从 compressBase64Image 开始到 callAliyunOcrTable 结束）
const ocrFunctions = content.substring(compressStart, ocrEnd + 1);
console.log('提取OCR函数，长度:', ocrFunctions.length);

// 删除原位置的函数
content = content.substring(0, compressStart) + content.substring(ocrEnd + 1);

// 在 createServer 之前插入
content = content.substring(0, serverLine) + '\n' + ocrFunctions + '\n' + content.substring(serverLine);

fs.writeFileSync(filePath, content);
console.log('完成');

// 验证
const check = fs.readFileSync(filePath, 'utf8');
const funcPos = check.indexOf('async function callAliyunOcr');
const serverPos = check.indexOf('http.createServer');
console.log('callAliyunOcr 位置:', funcPos, 'createServer 位置:', serverPos);
if (funcPos < serverPos) {
  console.log('✓ 函数已在createServer之前');
}
