'use strict';
module.exports = help;

const fs = require('then-fs');
const path = require('path');

function help(args, config) {
  let root = args.root;
  return getHelpItem(args, config).then(item => {
    return fs.readFile(path.join(root, item), 'utf8');
  });
}

function getHelpItem(args, config) {
  return new Promise((resolve, reject) => {
    if (config.help) {
      if (args.help === true) {
        return resolve(config.help._ || config.help);
      }

      if (config.help[args.help]) {
        return resolve(config.help[args.help]);
      }

      return reject(new Error(`"${args.help}" help can't be found`));
    }

    var error = new Error('No help configured');
    error.code = 'NO_HELP_CONFIGURED';
    reject(error);
  });
}