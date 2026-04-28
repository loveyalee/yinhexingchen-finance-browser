const fs = require('fs');
const filePath = '/var/www/yinhexingchen/server.js';
let content = fs.readFileSync(filePath, 'utf8');

// 找到 callAliyunOcr 函数并修复
const funcStart = content.indexOf('  async function callAliyunOcr(imageBase64, apiType) {');
if (funcStart === -1) {
  console.log('未找到函数');
  process.exit(1);
}

// 找到函数结束
let braceCount = 0;
let startFound = false;
let funcEnd = -1;

for (let i = funcStart; i < content.length; i++) {
  if (content[i] === '{') {
    braceCount++;
    startFound = true;
  } else if (content[i] === '}') {
    braceCount--;
    if (startFound && braceCount === 0) {
      funcEnd = i + 1;
      break;
    }
  }
}

console.log('函数结束于:', funcEnd);

// 新的函数实现
const newFunc = `  async function callAliyunOcr(imageBase64, apiType) {
    const crypto = require('crypto');
    const https = require('https');
    
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
    };
    
    // 生成签名
    const sortedKeys = Object.keys(params).sort();
    const canonicalizedQueryString = sortedKeys.map(key => {
      return encodeURIComponent(key) + '=' + encodeURIComponent(params[key]);
    }).join('&');
    
    const stringToSign = 'POST&' + encodeURIComponent('/') + '&' + encodeURIComponent(canonicalizedQueryString);
    const signature = crypto.createHmac('sha1', ALIYUN_ACCESS_KEY_SECRET + '&').update(stringToSign).digest('base64');
    
    params.Signature = signature;
    
    const payload = JSON.stringify(params);
    
    return new Promise((resolve, reject) => {
      const options = {
        hostname: 'ocr-api.cn-hangzhou.aliyuncs.com',
        port: 443,
        path: '/',
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Content-Length': Buffer.byteLength(payload)
        }
      };
      
      console.log('调用阿里云OCR, Action:', action);
      
      const req = https.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          console.log('阿里云OCR响应长度:', data.length);
          try {
            const result = JSON.parse(data);
            if (result.Code || result.Message) {
              reject(new Error(result.Message || result.Code));
            } else {
              resolve(result);
            }
          } catch (e) {
            console.error('OCR响应解析失败, 原始响应:', data.substring(0, 500));
            reject(new Error('OCR响应解析失败: ' + e.message));
          }
        });
      });
      
      req.on('error', reject);
      req.write(payload);
      req.end();
    });
  }`;

// 替换函数
content = content.substring(0, funcStart) + newFunc + content.substring(funcEnd);

fs.writeFileSync(filePath, content);
console.log('修复完成');
