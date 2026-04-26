#!/usr/bin/env node

'use strict';

const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');

const platform = process.platform;
const arch = process.arch;

const binMap = {
  'darwin-x64': 'ponderers-mcp-darwin-x64',
  'darwin-arm64': 'ponderers-mcp-darwin-arm64',
  'linux-x64': 'ponderers-mcp-linux-x64',
  'linux-arm64': 'ponderers-mcp-linux-arm64',
  'win32-x64': 'ponderers-mcp-win32-x64.exe',
};

const binName = binMap[`${platform}-${arch}`];

if (!binName) {
  process.stderr.write(`Error: unsupported platform ${platform}-${arch}\n`);
  process.stderr.write(`Supported platforms: ${Object.keys(binMap).join(', ')}\n`);
  process.exit(1);
}

const binPath = path.join(__dirname, binName);

async function ensureBinary() {
  if (fs.existsSync(binPath)) return;

  const packageJson = require('../package.json');
  const { downloadBinary } = require('../scripts/download');

  process.stderr.write('Binary not found, downloading from GitHub Release...\n');
  await downloadBinary(packageJson.version, binName, binPath);
  process.stderr.write('\nDownload complete, starting...\n');
}

function launch() {
  if (platform !== 'win32') {
    try { fs.chmodSync(binPath, '755'); } catch (_) {}
  }

  const child = spawn(binPath, process.argv.slice(2), {
    stdio: 'inherit',
    env: process.env,
  });

  child.on('exit', (code, signal) => {
    if (signal) {
      process.kill(process.pid, signal);
    } else {
      process.exit(code);
    }
  });

  child.on('error', (err) => {
    process.stderr.write(`Failed to start: ${err.message}\n`);
    process.exit(1);
  });

  process.on('SIGINT', () => {
    child.kill('SIGINT');
    child.kill('SIGTERM');
  });
}

ensureBinary()
  .then(launch)
  .catch((err) => {
    process.stderr.write(`\nFailed to obtain binary: ${err.message}\n`);
    process.stderr.write('Try reinstalling: npm install -g @liushoukai/ponderers-mcp\n');
    process.exit(1);
  });
