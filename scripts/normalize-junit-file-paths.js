#!/usr/bin/env node
/**
 * Normalize the `file="..."` attribute in jest-junit XML reports to use forward
 * slashes.
 *
 * jest-junit builds that attribute with Node's path APIs, so on Windows it
 * contains backslashes (e.g. file="test\jest\acceptance\foo.spec.ts"). CircleCI
 * keys its test-timing data on this attribute, but our pipeline feeds
 * forward-slash paths to `circleci tests run --timings-type=file`. The backslash
 * keys therefore never match and Windows falls back to name-based splitting.
 *
 * Rewriting just the `file=` attribute to forward slashes makes the stored
 * timing keys match the query, enabling timing-based splitting on Windows. Only
 * the `file=` attribute is touched, so backslashes inside test names or failure
 * messages are left untouched. This is a no-op on Linux/macOS.
 *
 * Usage: node scripts/normalize-junit-file-paths.js [reportsDir]
 */

const fs = require('fs');
const path = require('path');

const reportsDir = process.argv[2] || 'test/reports';

if (!fs.existsSync(reportsDir)) {
  process.exit(0);
}

const fileAttrPattern = /file="[^"]*"/g;

for (const entry of fs.readdirSync(reportsDir)) {
  if (!entry.endsWith('.xml')) {
    continue;
  }

  const filePath = path.join(reportsDir, entry);
  const original = fs.readFileSync(filePath, 'utf8');
  const normalized = original.replace(fileAttrPattern, (match) =>
    match.split('\\').join('/'),
  );

  if (normalized !== original) {
    fs.writeFileSync(filePath, normalized);
  }
}
