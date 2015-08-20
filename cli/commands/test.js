var snyk = require('../../');
var Promise = require('es6-promise').Promise; // jshint ignore:line

module.exports = function (path) {
  return snyk.test(path || process.cwd()).then(function (res) {
    if (res.ok) {
      return '✓ No vulnerabilities found';
    }

    throw new Error(res.vulnerabilities.map(function (vuln) {
      var name = vuln.name + '@' + vuln.version;
      var res = '✗ vulnerability found on ' + name + '\n';

      res += 'From ' + vuln.from.join(' > ') + '\n';
      res += vuln.info.join('\n');
      res += '\n';

      var upgradePath = (vuln.upgradePath || []).filter(Boolean).shift();

      if (upgradePath) {
        res += 'Upgrade to ' + upgradePath;
      } else {
        res += 'No patch path available';
      }
      return res;
    }).join('\n\n'));
  });
};