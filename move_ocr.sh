#!/bin/bash
cd /var/www/yinhexingchen

# 找到阿里云OCR函数的范围（7417-7493）
START=7417
END=7493

echo "提取行 $START 到 $END"

# 提取OCR函数
sed -n "${START},${END}p" server.js > /tmp/ocr_func.js

# 删除原位置的函数
sed -i "${START},${END}d" server.js

# 在createServer之前插入 (第2367行之前)
sed -i '2366r /tmp/ocr_func.js' server.js

# 验证
node --check server.js && echo "语法正确" || echo "语法错误"
