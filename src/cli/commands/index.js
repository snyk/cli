const abbrev = require('abbrev');
const woof = require('./woof');
const yargs = require('yargs');

require('../../lib/spinner').isRequired = false;

const parser = yargs(process.argv.slice(2))
  .help()
  .version()
  .command(woof.command);

// Wrapper for Commonjs compatibility
async function callModule(mod, args) {
  if (mod instanceof Promise) {
    const resolvedModule = await mod;
    return (resolvedModule.default || resolvedModule)(
      ...args,
      yargs(process.argv.slice(2)).argv,
    );
  } else {
    parser.argv; // execute
  }
}

const commands = {
  auth: async (...args) => callModule(import('./auth'), args),
  config: async (...args) => callModule(import('./config'), args),
  help: async (...args) => callModule(import('./help'), args),
  ignore: async (...args) => callModule(import('./ignore'), args),
  monitor: async (...args) => callModule(import('./monitor'), args),
  fix: async (...args) => callModule(import('./fix'), args),
  policy: async (...args) => callModule(import('./policy'), args),
  protect: async (...args) => callModule(import('./protect'), args),
  test: async (...args) => callModule(import('./test'), args),
  version: async (...args) => callModule(import('./version'), args),
  wizard: async (...args) => callModule(import('./protect/wizard'), args),
  woof: async (...args) => callModule(woof, args),
};

commands.aliases = abbrev(Object.keys(commands));
commands.aliases.t = 'test';

module.exports = commands;
