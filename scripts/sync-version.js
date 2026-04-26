#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');
const version = packageJson.version;

function syncFile(filePath, pattern, replacement, label) {
  const content = fs.readFileSync(filePath, 'utf8');
  const updated = content.replace(pattern, replacement);
  if (content === updated) {
    process.stderr.write(`${label} version is already ${version}\n`);
    return;
  }
  fs.writeFileSync(filePath, updated);
  process.stderr.write(`Synced ${label} version to ${version}\n`);
}

// Cargo.toml: replace the version line in [package] section
syncFile(
  path.join(__dirname, '../Cargo.toml'),
  /^version = ".*"$/m,
  `version = "${version}"`,
  'Cargo.toml'
);

// Cargo.lock: replace the version line directly under the root package entry
syncFile(
  path.join(__dirname, '../Cargo.lock'),
  /(name = "ponderers-mcp"\nversion = )"[^"]*"/,
  `$1"${version}"`,
  'Cargo.lock'
);
