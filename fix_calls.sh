#!/bin/bash
cd /var/www/yinhexingchen

# 替换所有 callTencentOcr 为 callAliyunOcr
sed -i 's/callTencentOcr/callAliyunOcr/g' server.js

# 验证替换成功
grep -n 'callAliyunOcr' server.js | head -5

# 验证没有 callTencentOcr 调用
grep 'callTencentOcr' server.js || echo "已无callTencentOcr调用"

# 删除 callTencentOcrTable 函数
START=$(grep -n 'async function callTencentOcrTable' server.js | cut -d: -f1)
if [ -n "$START" ]; then
  echo "找到callTencentOcrTable在行: $START"
  # 找到结束 }
  for i in $(seq $START 10000); do
    line=$(sed -n "${i}p" server.js)
    if echo "$line" | grep -q '^  }$'; then
      END=$i
      break
    fi
  done
  echo "函数结束于行: $END"
  sed -i "${START},${END}d" server.js
fi

# 验证语法
node --check server.js && echo "语法正确"
