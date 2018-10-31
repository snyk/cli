module.exports = ensurePatchExists;

var hasbin = require('hasbin');
var analytics = require('../analytics');
var chalk = require('chalk');
var exec = require('child_process').exec;
var err = new Error(
  'Snyk couldn\'t patch the specified ' +
  'vulnerabilities because GNU\'s patch is not ' +
  'available. Please install \'patch\' ' +
  'and try again. \n For more information ' +
  'please see our support page: '
  + chalk.underline(
    'https://support.snyk.io' +
    '/snyk-cli/snyk-protect-requires-the-patch-binary.'
  ));

function ensurePatchExists() {
  return new Promise(function (resolve, reject) {
    return hasbin('patch', function (exists) {
      // Output error if patch binary is not installed
      if (!exists) {
        analytics.add('patch-binary-missing', {
          message: err.message,
        });
        return reject(err);
      }
      // Output error if patch binary is not GNU version
      exec('patch --version', function (error, stdout) { // stderr is ignored
        var out = stdout.trim();
        if (out.indexOf('GNU') === -1) {
          analytics.add('patch-binary-missing', {
            message: err.message,
          });
          return reject(err);
        }
      });
      return resolve();
    });
  });
}
