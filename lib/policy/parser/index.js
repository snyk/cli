module.exports = parse;
module.exports.demunge = demunge;
var version = module.exports.version = 'v1';
var hotload = require('../../hotload')(__dirname);
var config = require('../../config');

var parsers = {
  v1: hotload('./v1'),
};

function parse(data) {
  if (!data) {
    data = {};
  }

  if (!data.version) {
    data.version = version;
  }

  if (!parsers[data.version]) {
    data.version = version;
  }

  return parsers[data.version](data);
}

function demunge(policy) {
  var res = ['ignore', 'patch'].reduce(function (acc, type) {
    acc[type] = policy[type] ? Object.keys(policy[type]).map(function (id) {
      var paths = policy[type][id].map(function (pathObj) {
        var path = Object.keys(pathObj).pop();
        var res = {
          path: path
        };
        if (type === 'ignore') {
          res.reason = pathObj[path].reason;
          res.expires = new Date(pathObj[path].expires);
        }

        return res;
      });
      return {
        id: id,
        url: config.ROOT + '/vuln/' + id,
        paths: paths,
      };
    }) : [];
    return acc;
  }, {});

  res.version = policy.version;

  return res;
}