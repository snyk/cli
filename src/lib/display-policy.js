module.exports = display;

var ansiColors = require('ansi-colors');
var demunge = require('snyk-policy').demunge;
var config = require('./config');

function display(policy) {
  return new Promise(function (resolve) {
    var p = demunge(policy, config.ROOT);

    var res = ansiColors.bold('Current Snyk policy, read from ' + policy.__filename +
      ' file') + '\n';
    res += 'Modified: ' + policy.__modified + '\n';
    res += 'Created:  ' + policy.__created + '\n';

    res += p.patch.map(displayRule('Patch vulnerability')).join('\n');
    if (p.patch.length && p.ignore.length) {
      res += '\n\n------------------------\n';
    }
    res += p.ignore.map(displayRule('Ignore')).join('\n');

    resolve(res);
  });
}

function displayRule(title) {
  return function (rule, i) {
    i += 1;
    return ansiColors.bold('\n#' + i + ' ' + title + ' ' + rule.url) +
      ' in the following paths:\n' +
      (rule.paths.map(function (p) {
        return p.path +
               (p.reason ? '\nReason: ' + p.reason +
               '\nExpires: ' + p.expires.toUTCString() + '\n': '')  + '\n';
      }).join('').replace(/\s*$/, ''));
  };
}
