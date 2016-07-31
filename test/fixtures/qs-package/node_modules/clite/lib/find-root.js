'use strict';

module.exports = findRoot;

const fs = require('then-fs');
const path = require('path');
const debug = require('debug')('clite');

function findRoot(paths) {
  return Promise.resolve().then(() => {
    let root = null;

    do {
      // strip the `node_modules`
      let dir = path.resolve(paths.shift(), '..');
      debug(dir);
      let filename = path.resolve(dir, 'package.json');
      try {
        fs.statSync(filename);
        root = dir;
        break;
      } catch (e) {
        if (paths.length) {
          return findRoot(paths);
        }

        throw e;
      }
    } while (paths.length);

    debug('root is %s', root);
    return root;
  });
}
