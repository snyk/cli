var resolveTree = require('../lib/');
var filter = require('./filter');
var print = require('./print');
var count = require('./count');
var fs = require('then-fs');

module.exports = function (args) {
  var src = args._.shift() || '.';
  return fs.stat(src).then(function (found) {
    if (found) {
      return resolveTree.physicalTree(src)
        .then(function (res) {
          if (args.disk) {
            return res;
          }

          return resolveTree.logicalTree(res, args);
        })
        .then(function (res) {
          filter(args, res);

          if (args.unique) {
            res = resolveTree.unique(res);
          }

          if (args.count) {
            if (typeof args.count === 'boolean' && args.filter) {
              args.count = args.filter;
            }
            return count(args, res);
          }

          if (args.json) {
            return JSON.stringify(res, '', 2);
          }

          return print(args, res);
        });
    }

    throw new Error('Can\'t load ' + src);
  });
};
