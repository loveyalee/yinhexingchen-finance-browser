const mysql = require('mysql2/promise');
const ssh = require('ssh2');

const sshConfig = {
  host: '111.230.36.222',
  port: 22,
  username: 'root',
  password: 'Yhx@123456'
};

const dbConfig = {
  host: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
  user: 'yinhexingchen',
  password: 'Yhx@123456',
  database: 'yinhexingchen'
};

async function queryAndFix() {
  // 通过腾讯云服务器执行命令
  const { Client } = ssh;
  
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    conn.on('ready', () => {
      console.log('SSH connected');
      
      // 使用exec执行mysql命令
      conn.exec(`mysql -h ${dbConfig.host} -u ${dbConfig.user} -p'${dbConfig.password}' ${dbConfig.database} -e "SELECT id, no, customer, project_name, contact, contact_phone FROM delivery_notes WHERE (project_name IS NOT NULL AND project_name != '' AND project_name != '-') OR (contact IS NOT NULL AND contact != '') LIMIT 50;"`, (err, stream) => {
        if (err) {
          console.error('Exec error:', err);
          conn.end();
          reject(err);
          return;
        }
        
        let output = '';
        stream.on('data', (data) => { output += data.toString(); });
        stream.stderr.on('data', (data) => { console.error('stderr:', data.toString()); });
        stream.on('close', () => {
          console.log('查询结果:');
          console.log(output);
          conn.end();
          resolve();
        });
      });
    });
    
    conn.on('error', (err) => {
      console.error('SSH error:', err);
      reject(err);
    });
    
    conn.connect(sshConfig);
  });
}

queryAndFix()
  .then(() => console.log('完成'))
  .catch(err => console.error('失败:', err));
