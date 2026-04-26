#!/usr/bin/env node

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const path = require('path');
const { promisify } = require('util');
const { pipeline } = require('stream');

const streamPipeline = promisify(pipeline);

// 配置参数
const MAX_RETRIES = 3; // 最大重试次数
const DOWNLOAD_TIMEOUT = 180000; // 下载超时时间（3分钟）
const RETRY_DELAY = 2000; // 重试延迟（2秒）

// 读取包版本
const packageJson = require('../package.json');
const version = packageJson.version;

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

// 设置路径
const binDir = path.join(__dirname, '../bin');
const binPath = path.join(binDir, binName);

// GitHub Release URL
const GITHUB_USER = 'liushoukai';
const GITHUB_REPO = 'ponderers-mcp';
const downloadUrl = `https://github.com/${GITHUB_USER}/${GITHUB_REPO}/releases/download/v${version}/${binName}`;

console.log(`正在为 ${platform}-${arch} 下载二进制文件...`);
console.log(`版本: v${version}`);
console.log(`下载地址: ${downloadUrl}`);

// 检查代理设置
const proxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
              process.env.HTTP_PROXY || process.env.http_proxy;
if (proxy) {
  console.log(`使用代理: ${proxy}`);
}

// 创建 bin 目录
if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

// 解析代理配置
function getProxyAgent(proxyUrl) {
  if (!proxyUrl) return null;

  try {
    const proxyURL = new URL(proxyUrl);
    // 注意：这里使用简单的代理支持，复杂场景建议使用 https-proxy-agent 包
    return {
      host: proxyURL.hostname,
      port: proxyURL.port || (proxyURL.protocol === 'https:' ? 443 : 80),
      protocol: proxyURL.protocol
    };
  } catch (err) {
    console.warn(`警告: 无法解析代理 URL: ${proxyUrl}`);
    return null;
  }
}

// 延迟函数
function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// 下载文件（支持超时和重定向）
async function download(url, dest, remainingRedirects = 10) {
  return new Promise((resolve, reject) => {
    if (remainingRedirects <= 0) {
      reject(new Error('重定向次数过多'));
      return;
    }

    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;

    const options = {
      headers: {
        'User-Agent': 'npm-installer'
      },
      timeout: DOWNLOAD_TIMEOUT
    };

    // 如果使用代理
    const proxyAgent = getProxyAgent(proxy);
    if (proxyAgent && parsedUrl.protocol === 'https:') {
      // 简单的 CONNECT 代理支持
      options.agent = false; // 禁用默认 agent
      // 注意：完整的代理支持需要 https-proxy-agent 包
      console.warn('检测到代理设置，但需要 https-proxy-agent 包以获得完整支持');
    }

    const request = protocol.get(url, options, (response) => {
      // 处理重定向
      if (response.statusCode === 301 || response.statusCode === 302 || response.statusCode === 307 || response.statusCode === 308) {
        const redirectUrl = response.headers.location;
        console.log(`重定向到: ${redirectUrl}`);
        return download(redirectUrl, dest, remainingRedirects - 1)
          .then(resolve)
          .catch(reject);
      }

      if (response.statusCode !== 200) {
        reject(new Error(`下载失败: HTTP ${response.statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloadedSize = 0;
      let lastPercent = 0;

      // 设置响应超时
      response.setTimeout(DOWNLOAD_TIMEOUT, () => {
        request.destroy();
        reject(new Error('下载超时'));
      });

      response.on('data', (chunk) => {
        downloadedSize += chunk.length;

        if (totalSize) {
          const percent = Math.floor((downloadedSize / totalSize) * 100);
          // 每 10% 输出一次进度
          if (percent >= lastPercent + 10) {
            process.stdout.write(`\r下载进度: ${percent}%`);
            lastPercent = percent;
          }
        }
      });

      streamPipeline(response, file)
        .then(() => {
          console.log('\r下载进度: 100%');
          console.log('下载完成!');

          // 在 Unix 系统上添加执行权限
          if (platform !== 'win32') {
            fs.chmodSync(dest, '755');
          }

          resolve();
        })
        .catch(reject);
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('请求超时'));
    });
  });
}

// 带重试的下载函数
async function downloadWithRetry(url, dest, retries = MAX_RETRIES) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      if (attempt > 1) {
        console.log(`\n第 ${attempt}/${retries} 次尝试...`);
        await delay(RETRY_DELAY);
      }

      await download(url, dest);
      return; // 下载成功，返回
    } catch (err) {
      console.error(`\n下载失败 (尝试 ${attempt}/${retries}):`, err.message);

      // 清理部分下载的文件
      if (fs.existsSync(dest)) {
        try {
          fs.unlinkSync(dest);
        } catch (cleanupErr) {
          // 忽略清理错误
        }
      }

      // 如果是最后一次尝试，抛出错误
      if (attempt === retries) {
        throw err;
      }
    }
  }
}

// 执行下载
downloadWithRetry(downloadUrl, binPath)
  .then(() => {
    console.log(`\n✅ 安装成功! 二进制文件位于: ${binPath}`);
    console.log('\n使用方法:');
    console.log('  npx @liushoukai/ponderers-mcp');
    console.log('  或在 MCP 配置中使用:');
    console.log('  { "command": "npx", "args": ["-y", "@liushoukai/ponderers-mcp"] }');
  })
  .catch((err) => {
    console.error('\n❌ 安装失败:', err.message);
    console.error('\n可能的原因:');
    console.error('1. 网络连接问题（已重试 3 次）');
    console.error('2. GitHub Release 尚未发布');
    console.error(`3. 版本 v${version} 的二进制文件不存在`);
    console.error('4. 需要使用代理访问 GitHub');
    console.error('\n如果需要使用代理，请设置环境变量:');
    console.error('  export HTTPS_PROXY=http://your-proxy:port');
    console.error('  export HTTP_PROXY=http://your-proxy:port');
    console.error('\n手动下载地址:');
    console.error(downloadUrl);
    console.error('\n手动安装步骤:');
    console.error('1. 下载上述文件');
    console.error(`2. 将文件保存到: ${binPath}`);
    console.error('3. 添加执行权限: chmod +x ' + binPath);

    // 清理失败的文件
    if (fs.existsSync(binPath)) {
      try {
        fs.unlinkSync(binPath);
      } catch (cleanupErr) {
        // 忽略清理错误
      }
    }

    process.exit(1);
  });
