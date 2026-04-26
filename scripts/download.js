#!/usr/bin/env node

'use strict';

const https = require('https');
const http = require('http');
const { URL } = require('url');
const fs = require('fs');
const { promisify } = require('util');
const { pipeline } = require('stream');

const streamPipeline = promisify(pipeline);

const MAX_RETRIES = 3;
const DOWNLOAD_TIMEOUT = 180000;
const RETRY_DELAY = 2000;

const GITHUB_USER = 'liushoukai';
const GITHUB_REPO = 'ponderers-mcp';

function buildDownloadUrl(version, binName) {
  return `https://github.com/${GITHUB_USER}/${GITHUB_REPO}/releases/download/v${version}/${binName}`;
}

function delay(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

function download(url, dest, remainingRedirects = 10) {
  return new Promise((resolve, reject) => {
    if (remainingRedirects <= 0) {
      reject(new Error('Too many redirects'));
      return;
    }

    const parsedUrl = new URL(url);
    const protocol = parsedUrl.protocol === 'https:' ? https : http;
    const proxy = process.env.HTTPS_PROXY || process.env.https_proxy ||
                  process.env.HTTP_PROXY || process.env.http_proxy;

    const options = {
      headers: { 'User-Agent': 'ponderers-mcp-installer' },
      timeout: DOWNLOAD_TIMEOUT,
    };

    if (proxy && parsedUrl.protocol === 'https:') {
      process.stderr.write('Proxy detected, but https-proxy-agent is required for full proxy support\n');
    }

    const request = protocol.get(url, options, (response) => {
      const { statusCode } = response;

      if (statusCode === 301 || statusCode === 302 || statusCode === 307 || statusCode === 308) {
        return download(response.headers.location, dest, remainingRedirects - 1)
          .then(resolve).catch(reject);
      }

      if (statusCode !== 200) {
        reject(new Error(`Download failed: HTTP ${statusCode}`));
        return;
      }

      const file = fs.createWriteStream(dest);
      const totalSize = parseInt(response.headers['content-length'], 10);
      let downloaded = 0;
      let lastPercent = 0;

      response.setTimeout(DOWNLOAD_TIMEOUT, () => {
        request.destroy();
        reject(new Error('Download timed out'));
      });

      response.on('data', (chunk) => {
        downloaded += chunk.length;
        if (totalSize) {
          const percent = Math.floor((downloaded / totalSize) * 100);
          if (percent >= lastPercent + 10) {
            process.stderr.write(`\rProgress: ${percent}%`);
            lastPercent = percent;
          }
        }
      });

      streamPipeline(response, file)
        .then(() => {
          process.stderr.write('\rProgress: 100%\n');
          if (process.platform !== 'win32') {
            fs.chmodSync(dest, '755');
          }
          resolve();
        })
        .catch(reject);
    });

    request.on('error', reject);
    request.on('timeout', () => {
      request.destroy();
      reject(new Error('Request timed out'));
    });
  });
}

async function downloadWithRetry(url, dest) {
  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    try {
      if (attempt > 1) {
        process.stderr.write(`\nAttempt ${attempt}/${MAX_RETRIES}...\n`);
        await delay(RETRY_DELAY);
      }
      await download(url, dest);
      return;
    } catch (err) {
      process.stderr.write(`\nAttempt ${attempt}/${MAX_RETRIES} failed: ${err.message}\n`);
      if (fs.existsSync(dest)) {
        try { fs.unlinkSync(dest); } catch (_) {}
      }
      if (attempt === MAX_RETRIES) throw err;
    }
  }
}

/**
 * Download the platform binary for the given version to dest.
 * @param {string} version  Package version, e.g. "1.0.1"
 * @param {string} binName  Binary filename, e.g. "ponderers-mcp-darwin-arm64"
 * @param {string} dest     Destination file path
 */
async function downloadBinary(version, binName, dest) {
  const url = buildDownloadUrl(version, binName);
  process.stderr.write(`Downloading binary: ${binName}\n`);
  process.stderr.write(`Version: v${version}\n`);
  process.stderr.write(`URL: ${url}\n`);
  await downloadWithRetry(url, dest);
}

module.exports = { downloadBinary, buildDownloadUrl };
