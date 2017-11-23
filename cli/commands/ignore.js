module.exports = ignore;

var debug = require('debug')('snyk');
var policy = require('snyk-policy');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var chalk = require('chalk');
var snyk = require('../../lib');
var authorization = require('../../lib/authorization');
var auth = require('./auth');

function ignore(options) {
  debug('snyk ignore called with options: %O', options);
  return auth.isAuthed().then(function (authed) {
    if (!authed) {
      return auth(null, 'ignore');
    }
  }).then(function () {
    return authorization.actionAllowed('cliIgnore', options);
  }).then(function (cliIgnoreAuthorization) {
    if (!cliIgnoreAuthorization.allowed) {
      debug('snyk ignore called when disallowed');
      console.log(chalk.bold.red(cliIgnoreAuthorization.reason));
      return;
    }

    if (!options.id) {
      throw Error('idRequired');
    }
    options.expiry = new Date(options.expiry);
    if (options.expiry.getTime() !== options.expiry.getTime()) {
      debug('No/invalid expiry given, using the default 30 days');
      options.expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
    }
    if (!options.reason) {
      options.reason = 'None Given';
    }

    debug(
      'changing policy: ignore "%s", for all paths, reason: "%s", until: %o',
      options.id, options.reason, options.expiry
    );
    return policy.load(options['policy-path'])
    .catch(function (error) {
      if (error.code === 'ENOENT') {    // file does not exist - create it
        return policy.create();
      }
      throw Error('policyFile');
    })
    .then(function ignoreIssue(pol) {
      pol.ignore[options.id] = [
        {
          '*':
          {
            reason: options.reason,
            expires: options.expiry,
          },
        },
      ];
      policy.save(pol, options['policy-path']);
    });
  })
}
