module.exports = ensurePatchExists;

var hasbin = require('hasbin');
var analytics = require('../analytics');
var chalk = require('chalk');

function ensurePatchExists() {
  return new Promise(function (resolve, reject) {
    return hasbin('patch', function (exists) {
      if (!exists) {
        var err =
        new Error(
          'Snyk couldn\'t patch the specified ' +
          'vulnerabilities because GNU\'s patch is not ' +
          'available. Please install \'patch\' ' +
          'and try again. \n For more information ' +
          'please see our support page: '
          + chalk.underline(
            'https://support.snyk.io' +
            '/snyk-cli/snyk-protect-requires-the-patch-binary.'
          ));
        analytics.add('patch-binary-missing', {
          message: err.message,
        });
        return reject(err);
      }
      return resolve();
    });
  });
}
