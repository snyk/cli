module.exports = ignore;

var debug = require('debug')('snyk');
var policy = require('snyk-policy');
var Promise = require('es6-promise').Promise; // jshint ignore:line

function ignore(options) {
  debug('snyk ignore called with options: %O', options);
  if (!options.id) {
    return Promise.reject(Error('idRequired'));
  }
  options.expiry = new Date(options.expiry);
  if (options.expiry.getTime() !== options.expiry.getTime()) {
    debug('No/invalid expiry given, using the default 30 days');
    options.expiry = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000);
  }
  if (!options.reason) {
    options.reason = 'None Given';
  }
  if (!options.path) {
    debug('using cwd() as path');
    options.path = process.cwd();
  }

  debug('changing policy: ignore "%s", for all paths, reason: "%s", until: %o',
        options.id, options.reason, options.expiry);
  return policy.load(options.path)
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
    policy.save(pol, options.path);
  });
}
