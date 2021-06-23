#!/usr/bin/env node

import protect from './lib';

async function main() {
  const projectPath = process.cwd();
  await protect(projectPath);
}

if (require.main === module) {
  main();
}
