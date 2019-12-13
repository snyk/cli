#!/usr/bin/env node
import 'source-map-support/register';
import { main, HANDLED_ERROR, EXIT_CODES } from './main';

const cli = main().catch((e) => {
  if (e !== HANDLED_ERROR) {
    console.error('Something unexpected went wrong: ', e.stack);
    console.error('Exit code: ' + EXIT_CODES.ERROR);
  }
  process.exit(EXIT_CODES.ERROR);
});

if (module.parent) {
  // eslint-disable-next-line id-blacklist
  module.exports = cli;
}
