#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
批量修复文件编码问题的脚本
"""

import os
import re

def fix_encoding(file_path):
    """
    修复单个文件的编码问题
    """
    try:
        # 读取文件内容
        with open(file_path, 'r', encoding='utf-8', errors='replace') as f:
            content = f.read()
        
        # 修复标题中的乱码
        # 匹配<title>标签中的内容
        title_pattern = r'<title>(.*?)</title>'
        title_match = re.search(title_pattern, content, re.DOTALL)
        if title_match:
            old_title = title_match.group(1)
            # 移除乱码字符
            new_title = old_title.replace('�', '')
            # 修复常见的标题
            if '浏览' in new_title and not new_title.endswith('浏览器'):
                new_title = new_title + '器'
            if '报税' in new_title and not new_title.startswith('一键报税'):
                new_title = '一键' + new_title
            # 替换标题
            content = content.replace(old_title, new_title)
        
        # 修复其他位置的乱码
        content = content.replace('�', '')
        
        # 保存修复后的内容
        with open(file_path, 'w', encoding='utf-8') as f:
            f.write(content)
        
        print(f"修复成功: {file_path}")
        return True
    except Exception as e:
        print(f"修复失败 {file_path}: {e}")
        return False

def main():
    """
    主函数，批量修复文件
    """
    # 要修复的文件列表
    files_to_fix = [
        'templates_tools.html',
        'tax_reporting.html',
        'smart_assistant.html',
        'seal_management.html',
        'risk_management.html',
        'paid_qa.html',
        'online_store.html',
        'invoice_management.html',
        'forum.html',
        'finance_jobs.html',
        'finance_bp.html',
        'finance_academy.html',
        'data_analysis.html',
        'customer_service.html',
        'contract_management.html',
        'cloud_chat.html',
        'budget_management.html',
        'audit_zone.html',
        'accounting_backup.html',
        'accounting.html',
        'finance_software.html'
    ]
    
    # 修复每个文件
    success_count = 0
    fail_count = 0
    
    for file_name in files_to_fix:
        file_path = os.path.join(os.getcwd(), file_name)
        if os.path.exists(file_path):
            if fix_encoding(file_path):
                success_count += 1
            else:
                fail_count += 1
        else:
            print(f"文件不存在: {file_path}")
            fail_count += 1
    
    print(f"\n修复完成: 成功 {success_count}, 失败 {fail_count}")

if __name__ == "__main__":
    main()
