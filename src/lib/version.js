const path = require('path');
const command = require('./exec');
const root = path.resolve(__dirname, '../..');

module.exports = function () {
  return new Promise(((resolve) => {
    const filename = path.resolve(root, 'package.json');
    const version = require(filename).version;

    if (version && version !== '0.0.0') {
      return resolve(version);
    }

    // else we're in development, give the commit out
    // get the last commit and whether the working dir is dirty
    const promises = [
      branch(),
      commit(),
      dirty(),
    ];

    resolve(Promise.all(promises).catch(() => {
      // handle any point where the git based lookup fails
      return ['unknown', '', '0'];
    }).then((res) => {
      const branch = res[0];
      const commit = res[1];
      const dirtyCount = parseInt(res[2], 10);
      let curr = branch + ': ' + commit;
      if (dirtyCount !== 0) {
        curr += ' (' + dirtyCount + ' dirty files)';
      }

      return curr;
    }));
  }));
};

function commit() {
  return command('git rev-parse HEAD', root);
}

function branch() {
  return command('git rev-parse --abbrev-ref HEAD', root);
}

function dirty() {
  return command('expr $(git status --porcelain 2>/dev/null| ' +
      'egrep "^(M| M)" | wc -l)', root);
}
