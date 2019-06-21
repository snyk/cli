var snyk = require('../../lib');

module.exports = function config(method) {
  var args = [].slice.call(arguments, 1);
  var key = args[0];

  return new Promise((resolve) => {
    var res = '';
    if (method === 'set') {
      args.map((item) => {
        return item.split('=');
      }).forEach((pair) => {
        res += pair[0] + ' updated\n';
        snyk.config.set.apply(snyk.config, pair);

        // ensure we update the live library
        if (pair[0] === 'api') {
          snyk.api = pair[1];
        }
      });
      res = res.trim(); // for clean response
    } else if (method === 'get') {
      if (!key) {
        throw new Error('config:get requires an argument');
      }
      res = snyk.config.get(key);
    } else if (method === 'unset') {
      if (!key) {
        throw new Error('config:unset requires an argument');
      }
      snyk.config.delete(key);
      res = key + ' deleted';
      if (key === 'api') {
        // ensure we update the live library
        snyk.api = null;
      }
    } else if (method === 'clear') {
      snyk.config.clear();
      // ensure we update the live library
      snyk.api = null;
      res = 'config cleared';
    } else if (!method) {
      res = Object.keys(snyk.config.all)
        .sort((a, b) => (a.toLowerCase() < b.toLowerCase()))
        .reduce((acc, curr) => {
          acc += curr + ': ' + snyk.config.all[curr] + '\n';
          return acc;
        }, '').trim();
    } else {
      throw new Error('Unknown config command "' + method + '"');
    }

    resolve(res);
  });
};
