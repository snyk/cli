#!/usr/bin/env node

import { doProtect } from './lib';

function main() {
  doProtect();
}

if (require.main === module) {
  main();
}
