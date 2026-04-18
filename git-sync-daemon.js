#!/usr/bin/env node

/**
 * Git 实时同步守护进程
 * 监视本地文件变更，自动提交和推送到 GitHub
 *
 * 使用方法:
 *   node git-sync-daemon.js
 *
 * 配置:
 *   - 监视间隔: 5 秒
 *   - 自动提交: 有改动时自动提交
 *   - 自动推送: 每提交一次就推送
 *   - 忽略文件: 按 .gitignore 规则
 */

const fs = require('fs');
const path = require('path');
const { execSync, spawn } = require('child_process');

// 配置
const CONFIG = {
  WATCH_INTERVAL: 5000,        // 监视间隔 (毫秒)
  PUSH_INTERVAL: 30000,        // 推送间隔 (毫秒)
  MAX_RETRIES: 3,              // 推送失败重试次数
  REPO_PATH: process.cwd(),    // 仓库路径
  BRANCH: 'master',            // 分支名
};

// 全局状态
let lastCommitTime = Date.now();
let pendingChanges = false;
let isPushing = false;

/**
 * 执行git命令
 */
function gitCmd(cmd) {
  try {
    const result = execSync(`git ${cmd}`, {
      cwd: CONFIG.REPO_PATH,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'pipe']
    });
    return { success: true, output: result.trim() };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 检查是否有未提交的改动
 */
function hasChanges() {
  const result = gitCmd('status --porcelain');
  if (!result.success) return false;
  return result.output.length > 0;
}

/**
 * 获取未提交改动摘要
 */
function getChangesSummary() {
  const result = gitCmd('status -s');
  if (!result.success) return '';
  return result.output;
}

/**
 * 提交改动
 */
function commitChanges() {
  const timestamp = new Date().toISOString();
  const summary = getChangesSummary();

  if (!summary) {
    console.log(`[${timestamp}] ℹ️  没有改动需要提交`);
    return false;
  }

  console.log(`[${timestamp}] 📝 检测到改动，准备提交:`);
  console.log(summary.split('\n').slice(0, 10).map(s => `  ${s}`).join('\n'));

  // 添加所有改动
  gitCmd('add -A');

  // 生成提交消息
  const commitMsg = `[Auto-Sync] ${timestamp.split('T')[0]} ${timestamp.split('T')[1].slice(0, 8)}`;

  // 提交
  const commitResult = gitCmd(`commit -m "${commitMsg}"`);

  if (commitResult.success) {
    console.log(`[${timestamp}] ✅ 提交成功: ${commitMsg}`);
    lastCommitTime = Date.now();
    pendingChanges = true;
    return true;
  } else {
    console.log(`[${timestamp}] ❌ 提交失败: ${commitResult.error}`);
    return false;
  }
}

/**
 * 推送改动到GitHub
 */
function pushChanges(retryCount = 0) {
  if (isPushing || !pendingChanges) return;

  isPushing = true;
  const timestamp = new Date().toISOString();

  console.log(`[${timestamp}] 🚀 准备推送到GitHub...`);

  const pushCmd = spawn('git', ['push', 'origin', CONFIG.BRANCH], {
    cwd: CONFIG.REPO_PATH,
    timeout: 60000
  });

  let output = '';
  let errorOutput = '';

  pushCmd.stdout.on('data', (data) => {
    output += data.toString();
  });

  pushCmd.stderr.on('data', (data) => {
    errorOutput += data.toString();
  });

  pushCmd.on('close', (code) => {
    isPushing = false;

    if (code === 0) {
      console.log(`[${timestamp}] ✨ 推送成功到 GitHub`);
      pendingChanges = false;
    } else {
      console.log(`[${timestamp}] ⚠️  推送失败 (代码: ${code})`);

      if (retryCount < CONFIG.MAX_RETRIES) {
        console.log(`[${timestamp}] 🔄 5秒后重试... (${retryCount + 1}/${CONFIG.MAX_RETRIES})`);
        setTimeout(() => pushChanges(retryCount + 1), 5000);
      } else {
        console.log(`[${timestamp}] ❌ 推送失败，已达最大重试次数`);
      }
    }

    if (errorOutput) {
      console.log(`[${timestamp}] 错误信息: ${errorOutput.slice(0, 100)}`);
    }
  });
}

/**
 * 获取本地和远程的提交差异
 */
function getCommitDiff() {
  const result = gitCmd('log --oneline -n 5 origin/master..HEAD');
  if (!result.success) return '';
  return result.output;
}

/**
 * 定期拉取远程更新
 */
function pullRemoteChanges() {
  const result = gitCmd('pull origin master --no-edit');
  if (result.success) {
    const timestamp = new Date().toISOString();
    console.log(`[${timestamp}] 📥 从GitHub拉取了最新更新`);
  }
}

/**
 * 启动监视循环
 */
function startWatching() {
  const timestamp = new Date().toISOString();
  console.log(`\n${'='.repeat(60)}`);
  console.log(`⏱️  Git 实时同步守护进程已启动`);
  console.log(`时间: ${timestamp}`);
  console.log(`仓库: ${CONFIG.REPO_PATH}`);
  console.log(`分支: ${CONFIG.BRANCH}`);
  console.log(`监视间隔: ${CONFIG.WATCH_INTERVAL / 1000}秒`);
  console.log(`${'='.repeat(60)}\n`);

  // 主监视循环
  setInterval(() => {
    if (hasChanges()) {
      commitChanges();
    }
  }, CONFIG.WATCH_INTERVAL);

  // 定期推送循环
  setInterval(() => {
    if (pendingChanges && !isPushing) {
      pushChanges();
    }
  }, CONFIG.PUSH_INTERVAL);

  // 定期检查远程更新（每10分钟一次）
  setInterval(() => {
    pullRemoteChanges();
  }, 600000);
}

/**
 * 显示当前状态
 */
function showStatus() {
  const timestamp = new Date().toISOString();
  const changes = getChangesSummary();
  const diff = getCommitDiff();

  console.log(`\n[${timestamp}] 📊 当前状态:`);
  console.log(`  本地改动: ${changes ? '有' : '无'}`);
  console.log(`  等待推送: ${pendingChanges ? '是' : '否'}`);
  console.log(`  推送中: ${isPushing ? '是' : '否'}`);

  if (diff) {
    console.log(`  待推送的提交:`);
    diff.split('\n').slice(0, 5).forEach(line => {
      console.log(`    ${line}`);
    });
  }
}

/**
 * 优雅关闭
 */
function gracefulShutdown() {
  const timestamp = new Date().toISOString();
  console.log(`\n[${timestamp}] 🛑 收到关闭信号，正在优雅关闭...`);

  // 最后一次推送
  if (pendingChanges) {
    console.log(`[${timestamp}] 📤 执行最后的推送...`);
    const result = gitCmd('push origin master');
    if (result.success) {
      console.log(`[${timestamp}] ✅ 最后的推送成功`);
    }
  }

  console.log(`[${timestamp}] 👋 守护进程已关闭\n`);
  process.exit(0);
}

/**
 * 主程序入口
 */
function main() {
  // 检查git仓库
  const gitCheckResult = gitCmd('rev-parse --git-dir');
  if (!gitCheckResult.success) {
    console.error('❌ 错误: 当前目录不是一个有效的git仓库');
    process.exit(1);
  }

  // 启动监视
  startWatching();

  // 定期显示状态
  setInterval(showStatus, 120000); // 每2分钟显示一次

  // 处理关闭信号
  process.on('SIGINT', gracefulShutdown);
  process.on('SIGTERM', gracefulShutdown);
}

// 启动
main();
