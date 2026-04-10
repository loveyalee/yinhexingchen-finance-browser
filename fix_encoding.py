#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
修复文件编码问题的脚本
"""

import codecs
import os

def fix_encoding(input_file, output_file):
    """
    尝试多种编码方案来修复文件
    """
    encodings = ['utf-8', 'gbk', 'gb2312', 'utf-16']
    
    for encoding in encodings:
        try:
            print(f"尝试使用 {encoding} 编码读取文件...")
            with codecs.open(input_file, 'r', encoding=encoding, errors='replace') as f:
                content = f.read()
            
            # 保存为UTF-8编码
            with codecs.open(output_file, 'w', encoding='utf-8') as f:
                f.write(content)
            
            print(f"成功使用 {encoding} 编码读取并保存为UTF-8")
            return True
        except Exception as e:
            print(f"使用 {encoding} 编码失败: {e}")
            continue
    
    print("所有编码方案都失败了")
    return False

if __name__ == "__main__":
    input_file = "finance_management.html"
    output_file = "finance_management_fixed.html"
    
    print(f"正在修复文件: {input_file}")
    success = fix_encoding(input_file, output_file)
    
    if success:
        print(f"修复成功，输出文件: {output_file}")
    else:
        print("修复失败")
