#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');

const packageJson = require('../package.json');
const version = packageJson.version;

const cargoPath = path.join(__dirname, '../Cargo.toml');
const cargo = fs.readFileSync(cargoPath, 'utf8');

// Only replace the version line in the [package] section
const updated = cargo.replace(/^version = ".*"$/m, `version = "${version}"`);

if (cargo === updated) {
  process.stderr.write(`Cargo.toml version is already ${version}\n`);
  process.exit(0);
}

fs.writeFileSync(cargoPath, updated);
process.stderr.write(`Synced Cargo.toml version to ${version}\n`);
