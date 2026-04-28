module.exports = {
  apps: [{
    name: 'yinhexingchen',
    script: 'server.js',
    cwd: '/var/www/yinhexingchen',
    env: {
      NODE_ENV: 'production',
      PORT: 54200,
      MYSQL_HOST: 'rm-bp1t731ujc98jo9c10o.mysql.rds.aliyuncs.com',
      MYSQL_PORT: 3306,
      MYSQL_DATABASE: 'rds_dingding',
      MYSQL_USER: 'ram_dingding',
      MYSQL_PASSWORD: 'h5J5BVEXtrjKVDSxmS4w'
    }
  }]
};
