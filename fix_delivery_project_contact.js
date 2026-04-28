/**
 * 从阿里云数据库获取有项目和联系人信息的送货单数据
 * 通过腾讯云代理访问
 */
const mysql = require('mysql2/promise');
const { Client } = require('ssh2');

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
  database: 'yinhexingchen',
  port: 3306
};

async function fixDeliveryNotes() {
  return new Promise((resolve, reject) => {
    const conn = new Client();
    
    conn.on('ready', async () => {
      console.log('SSH连接成功');
      
      // 使用SSH隧道转发本地端口
      const server = conn.forwardOut('127.0.0.1', 0, '127.0.0.1', 3306, async (err, stream) => {
        if (err) {
          console.error('SSH隧道错误:', err);
          conn.end();
          reject(err);
          return;
        }

        try {
          const db = await mysql.createConnection({
            host: '127.0.0.1',
            user: dbConfig.user,
            password: dbConfig.password,
            database: dbConfig.database,
            port: 33061, // 本地转发端口
            stream: stream
          });

          console.log('数据库连接成功');

          // 查询所有有项目或联系人信息的送货单
          const [notes] = await db.query(`
            SELECT id, no, customer, project_name, contact, contact_phone, address
            FROM delivery_notes 
            WHERE (project_name IS NOT NULL AND project_name != '' AND project_name != '-')
               OR (contact IS NOT NULL AND contact != '')
            ORDER BY id
          `);

          console.log(`\n找到 ${notes.length} 条有项目或联系人信息的送货单:\n`);
          
          for (const note of notes) {
            console.log(`ID: ${note.id}, 单号: ${note.no}`);
            console.log(`  客户: ${note.customer}`);
            console.log(`  项目: ${note.project_name || '(无)'}`);
            console.log(`  联系人: ${note.contact || '(无)'}, 电话: ${note.contact_phone || '(无)'}`);
            console.log('---');
          }

          await db.end();
          conn.end();
          resolve(notes);
        } catch (err) {
          console.error('数据库错误:', err);
          conn.end();
          reject(err);
        }
      });
      
      // 简单实现端口转发
      const net = require('net');
      const localPort = 33061;
      
      const localServer = net.createServer((localSocket) => {
        const remoteConn = new net.Socket();
        remoteConn.connect(3306, '127.0.0.1');
        
        localSocket.pipe(remoteConn);
        remoteConn.pipe(localSocket);
      });
      
      localServer.listen(localPort, '127.0.0.1', () => {
        console.log(`本地端口 ${localPort} 监听中`);
      });
    });

    conn.on('error', (err) => {
      console.error('SSH错误:', err);
      reject(err);
    });

    conn.connect(sshConfig);
  });
}

fixDeliveryNotes()
  .then(() => console.log('\n完成'))
  .catch(err => console.error('\n失败:', err.message));
