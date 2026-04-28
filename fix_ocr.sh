#!/bin/bash
cd /var/www/yinhexingchen

# 备份
cp server.js server.js.bak4

# 找到阿里云OCR函数的开始行
START=$(grep -n '  // 阿里云 OCR API 调用' server.js | head -1 | cut -d: -f1)
END=$(grep -n "  } else if (pathname === '/api/ocr/general'" server.js | head -1 | cut -d: -f1)

echo "START=$START, END=$END"

if [ -z "$START" ] || [ -z "$END" ]; then
  echo "未找到关键行"
  exit 1
fi

# 提取OCR函数内容（不包括结束行）
sed -n "${START},$((END-1))p" server.js > /tmp/ocr_funcs.js

# 删除原位置的函数
sed -i "${START},$((END-1))d" server.js

# 找到第一个 } else if 的行号
FIRST_ELSEIF=$(grep -n "^  } else if" server.js | head -1 | cut -d: -f1)
echo "第一个 else if 在行 $FIRST_ELSEIF"

# 创建临时文件，先添加空行再插入函数
echo "" > /tmp/ocr_header.txt
cat /tmp/ocr_header.txt /tmp/ocr_funcs.js > /tmp/ocr_combined.js

# 在其前面插入OCR函数
sed -i "${FIRST_ELSEIF}r /tmp/ocr_combined.js" server.js

# 验证语法
node --check server.js && echo "语法正确" || echo "语法错误"
