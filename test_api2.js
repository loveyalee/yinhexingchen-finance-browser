const http = require('http');

http.get('http://127.0.0.1:54200/api/delivery-notes?userId=USER_1776900041357', (res) => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const json = JSON.parse(data);
    console.log('项目:', json.data.map(x => x.project_name));
    console.log('联系人:', json.data.map(x => x.contact));
  });
}).on('error', e => console.error(e));
