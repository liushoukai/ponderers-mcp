#!/usr/bin/env node

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

// 检测平台和架构
const platform = process.platform;
const arch = process.arch;

// 二进制文件名映射
const binMap = {
  'darwin-x64': 'ponderers-mcp-darwin-x64',
  'darwin-arm64': 'ponderers-mcp-darwin-arm64',
  'linux-x64': 'ponderers-mcp-linux-x64',
  'linux-arm64': 'ponderers-mcp-linux-arm64',
  'win32-x64': 'ponderers-mcp-win32-x64.exe',
};

const binKey = `${platform}-${arch}`;
const binName = binMap[binKey];

if (!binName) {
  console.error(`错误: 不支持的平台 ${platform}-${arch}`);
  console.error('支持的平台:', Object.keys(binMap).join(', '));
  process.exit(1);
}

// 二进制文件路径
const binPath = path.join(__dirname, binName);

// 检查二进制文件是否存在
if (!fs.existsSync(binPath)) {
  console.error(`错误: 找不到二进制文件 ${binName}`);
  console.error(`路径: ${binPath}`);
  console.error('');
  console.error('请尝试重新安装:');
  console.error('  npm install -g @liushoukai/ponderers-mcp');
  process.exit(1);
}

// 确保文件有执行权限 (Unix 系统)
if (platform !== 'win32') {
  try {
    fs.chmodSync(binPath, '755');
  } catch (err) {
    // 忽略权限错误
  }
}

// 执行 Rust 二进制文件，透传所有参数和输入输出
const child = spawn(binPath, process.argv.slice(2), {
  stdio: 'inherit', // 继承父进程的 stdin, stdout, stderr
  env: process.env, // 继承环境变量
});

// 处理退出
child.on('exit', (code, signal) => {
  if (signal) {
    process.kill(process.pid, signal);
  } else {
    process.exit(code);
  }
});

// 处理错误
child.on('error', (err) => {
  console.error('启动失败:', err.message);
  process.exit(1);
});

// 处理中断信号
process.on('SIGINT', () => {
  child.kill('SIGINT');
  child.kill('SIGTERM');
});
