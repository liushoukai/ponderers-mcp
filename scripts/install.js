#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const { downloadBinary } = require('./download');

const packageJson = require('../package.json');
const version = packageJson.version;

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
  // Unsupported platform — skip pre-download, let the first run handle it
  process.stderr.write(`Warning: unsupported platform ${platform}-${arch}, skipping pre-download\n`);
  process.exit(0);
}

const binDir = path.join(__dirname, '../bin');
const binPath = path.join(binDir, binName);

if (!fs.existsSync(binDir)) {
  fs.mkdirSync(binDir, { recursive: true });
}

if (fs.existsSync(binPath)) {
  process.stderr.write('Binary already exists, skipping download\n');
  process.exit(0);
}

downloadBinary(version, binName, binPath)
  .then(() => {
    process.stderr.write(`\nPre-download successful: ${binPath}\n`);
  })
  .catch((err) => {
    // Pre-download failure does not block installation — first run will retry
    process.stderr.write(`\nPre-download failed: ${err.message}\n`);
    process.stderr.write('The binary will be downloaded automatically on first run\n');
    process.exit(0);
  });
