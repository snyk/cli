module.exports = ignore;

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var stripVersions = require('./strip-versions');
var oneDay = 1000 * 60 * 60 * 24;

function ignore(data) {
  return new Promise(function (resolve) {
    var config = {};
    config.ignore = data.map(function (res) {
      var vuln = res.vuln;
      var days = res.meta.days || 30;
      var ignoreRule = {};
      ignoreRule[stripVersions(vuln.from.slice(1)).join(' > ')] = {
        reason: res.meta.reason,
        expires: new Date(Date.now() + (oneDay * days)).toJSON(),
      };
      ignoreRule.vulnId = vuln.id;
      return ignoreRule;
    }).reduce(function (acc, curr) {
      if (!acc[curr.vulnId]) {
        acc[curr.vulnId] = [];
      }

      var id = curr.vulnId;
      delete curr.vulnId;
      acc[id].push(curr);

      return acc;
    }, {});

    // final format looks like test/fixtures/protect-interactive-config.json
    debug('ignore config', config);

    resolve(config);
  });
}
