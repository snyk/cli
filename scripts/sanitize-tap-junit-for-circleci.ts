/**
 * Strip `<properties>...</properties>` blocks from TAP's JUnit reporter output.
 * CircleCI's test-results parser rejects those nodes (see @tapjs/reporter junit.js).
 *
 * Usage: npx ts-node scripts/sanitize-tap-junit-for-circleci.ts [path-to-junit.xml]
 * Default path: tap-junit.xml in cwd.
 */

import * as fs from 'fs';
import * as path from 'path';

const target = path.resolve(process.argv[2] ?? 'tap-junit.xml');

if (!fs.existsSync(target)) {
  console.error(`sanitize-tap-junit-for-circleci: file not found: ${target}`);
  process.exit(1);
}

let xml = fs.readFileSync(target, 'utf8');
const before = xml.length;
xml = xml.replace(/<properties>[\s\S]*?<\/properties>\s*/g, '');
fs.writeFileSync(target, xml);
console.error(
  `sanitize-tap-junit-for-circleci: stripped properties from ${path.basename(target)} (${before} -> ${xml.length} bytes)`,
);
