#!/usr/bin/env python
# -*- coding: utf-8 -*-

# 确保文件是UTF-8编码
with open('E:/yinhexingchen/inventory_management.html', 'r', encoding='utf-8') as f:
    content = f.read()

with open('E:/yinhexingchen/inventory_management.html', 'w', encoding='utf-8') as f:
    f.write(content)

print('文件已保存为UTF-8编码！')
