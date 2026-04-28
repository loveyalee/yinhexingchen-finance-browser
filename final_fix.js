const fs = require('fs');
const filePath = '/var/www/yinhexingchen/server.js';
let content = fs.readFileSync(filePath, 'utf8');

console.log('开始修复...');

// 1. 替换所有 callTencentOcr 为 callAliyunOcr
content = content.replace(/callTencentOcr/g, 'callAliyunOcr');
console.log('1. 替换callTencentOcr');

// 2. 删除 callTencentOcrTable 函数
const tencentTableMatch = content.match(/\n  \/\/ 腾讯云表格识别专用API[\s\S]*?async function callTencentOcrTable[\s\S]*?^  \}\n/);
if (tencentTableMatch) {
  content = content.replace(tencentTableMatch[0], '\n');
  console.log('2. 删除callTencentOcrTable函数');
}

// 3. 在 callAliyunOcr 函数中添加 Action 参数
const oldFunc = `  async function callAliyunOcr(imageBase64, apiType) {
    const crypto = require('crypto');
    const https = require('https');
    
    // 提取纯 base64 数据
    let imageData = imageBase64;
    if (imageBase64.startsWith('data:')) {
      imageData = imageBase64.split(',')[1];
    }
    
    const imageSizeKB = Math.ceil(imageData.length * 0.75 / 1024);
    console.log(\`OCR请求图片大小: \${imageSizeKB}KB\`);
    
    // 阿里云 OCR API 参数
    const params = {
      Format: 'JSON',
      Version: '2021-07-07',
      AccessKeyId: ALIYUN_ACCESS_KEY_ID,
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: new Date().toISOString(),
      SignatureVersion: '1.0',
      SignatureNonce: Math.random().toString(),
      RegionId: ALIYUN_REGION,
      ImageBase64: imageData
    };`;

const newFunc = `  async function callAliyunOcr(imageBase64, apiType) {
    const crypto = require('crypto');
    const https = require('https');
    
    // 提取纯 base64 数据
    let imageData = imageBase64;
    if (imageBase64.startsWith('data:')) {
      imageData = imageBase64.split(',')[1];
    }
    
    const imageSizeKB = Math.ceil(imageData.length * 0.75 / 1024);
    console.log('OCR请求图片大小: ' + imageSizeKB + 'KB, 类型: ' + apiType);
    
    // 根据 apiType 确定 Action
    let action = 'RecognizeBasicGeneral';
    if (apiType === 'table') {
      action = 'RecognizeTableOCR';
    }
    
    // 阿里云 OCR API 参数
    const params = {
      Format: 'JSON',
      Version: '2019-11-07',
      AccessKeyId: ALIYUN_ACCESS_KEY_ID,
      SignatureMethod: 'HMAC-SHA1',
      Timestamp: new Date().toISOString(),
      SignatureVersion: '1.0',
      SignatureNonce: Math.random().toString(),
      RegionId: ALIYUN_REGION || 'cn-hangzhou',
      ImageBase64: imageData,
      Action: action
    };`;

if (content.includes(oldFunc)) {
  content = content.replace(oldFunc, newFunc);
  console.log('3. 添加Action参数');
} else {
  console.log('3. 未找到目标函数模式，跳过');
}

// 4. 删除兼容旧接口名称的函数
const compatRegex = /\n  \/\/ 兼容旧接口名称\n  async function callTencentOcr[\s\S]*?return await callAliyunOcr[\s\S]*?}\n/g;
content = content.replace(compatRegex, '\n');
console.log('4. 删除兼容函数');

fs.writeFileSync(filePath, content);
console.log('修复完成');

// 验证
const result = fs.readFileSync(filePath, 'utf8');
if (result.includes('callTencentOcr(')) {
  console.log('警告: 仍有callTencentOcr调用');
}
if (!result.includes('Action: action')) {
  console.log('警告: 未添加Action参数');
}
