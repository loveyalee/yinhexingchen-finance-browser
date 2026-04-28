const http = require('http');

const url = 'http://127.0.0.1:54200/api/delivery-notes?userId=USER_1776900041357';

http.get(url, (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('项目:', json.data.map(x => x.project_name));
    console.log('联系人:', json.data.map(x => x.contact));
    console.log('原始数据示例:', JSON.stringify(json.data[0], null, 2));
  });
}).on('error', e => console.error(e));
