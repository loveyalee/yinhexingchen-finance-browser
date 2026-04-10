#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
批量修复文件编码问题的脚本 - 版本2
"""

import os
import re

def fix_encoding(file_path):
    """
    修复单个文件的编码问题
    """
    try:
        # 读取文件内容
        with open(file_path, 'r', encoding='utf-8', errors='ignore') as f:
            content = f.read()
        
        # 修复标题
        # 常见标题映射
        title_fixes = {
            '模板专区 - 银河星辰财务专用浏览': '模板专区 - 银河星辰财务专用浏览器',
            '一键报 - 银河星辰财务专用浏览': '一键报税 - 银河星辰财务专用浏览器',
            '智能财务助手 - 银河星辰财务专用浏览': '智能财务助手 - 银河星辰财务专用浏览器',
            '电子印章管理 - 银河星辰财务专用浏览': '电子印章管理 - 银河星辰财务专用浏览器',
            '风险预警 - 银河星辰财务专用浏览': '风险预警 - 银河星辰财务专用浏览器',
            '付费问答 - 银河星辰财务专用浏览': '付费问答 - 银河星辰财务专用浏览器',
            '在线商城 - 银河星辰财务专用浏览': '在线商城 - 银河星辰财务专用浏览器',
            '发票管理 - 银河星辰财务专用浏览': '发票管理 - 银河星辰财务专用浏览器',
            '会计论坛 - 银河星辰财务专用浏览': '会计论坛 - 银河星辰财务专用浏览器',
            '财务快聘 - 银河星辰财务专用浏览': '财务快聘 - 银河星辰财务专用浏览器',
            '财务BP - 银河星辰财务专用浏览': '财务BP - 银河星辰财务专用浏览器',
            '财务学堂 - 银河星辰财务专用浏览': '财务学堂 - 银河星辰财务专用浏览器',
            '财务数据分析 - 银河星辰财务专用浏览': '财务数据分析 - 银河星辰财务专用浏览器',
            '客户服务 - 银河星辰财务专用浏览': '客户服务 - 银河星辰财务专用浏览器',
            '合同管理 - 银河星辰财务专用浏览': '合同管理 - 银河星辰财务专用浏览器',
            '个人云盘 - 银河星辰财务专用浏览': '个人云盘 - 银河星辰财务专用浏览器',
            '预算管理 - 银河星辰财务专用浏览': '预算管理 - 银河星辰财务专用浏览器',
            '审计专区 - 银河星辰财务专用浏览': '审计专区 - 银河星辰财务专用浏览器',
            '财务软件备份 - 银河星辰财务专用浏览': '财务软件备份 - 银河星辰财务专用浏览器',
            '财务软件 - 银河星辰财务专用浏览': '财务软件 - 银河星辰财务专用浏览器',
            '一键报税 - 银河星辰财务专用浏览': '一键报税 - 银河星辰财务专用浏览器',
        }
        
        # 修复标题
        for old_title, new_title in title_fixes.items():
            if old_title in content:
                content = content.replace(old_title, new_title)
        
        # 修复其他常见乱码
        content = content.replace('浏览?', '浏览器')
        content = content.replace('报?', '报税')
        content = content.replace('?', '')  # 移除剩余的乱码字符
        
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
