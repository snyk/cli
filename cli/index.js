#!/usr/bin/env node

var args = require('./args')(process.argv);
var debug = require('debug')('snyk');

var exitcode = 0;

args.method.apply(null, args.options._).then(function (result) {
  if (result && !args.options.quiet) {
    console.log(result);
  }
}).catch(function (error) {
  if (args.options.debug) {
    console.log(error.stack);
  } else {
    var errors = require('../lib/error');
    if (!args.options.quiet) {
      console.log(errors.message(error));
    }
  }
  exitcode = 1;
  return error;
}).then(function (res) {
  if (res && res.code === 'UNKNOWN_COMMAND') {
    // don't log analytics for unknown commands
    return;
  }
  var analytics = require('../lib/analytics');
  return analytics({
    command: args.command,
    args: args.options._,
  });
}).catch(function (e) {
  console.log('super fail', e.stack);
}).then(function () {
  if (exitcode) {
    process.exit(1);
  }
});

debug('checking for cli updates');
// finally, check for available update and returns an instance
var defaults = require('lodash').defaults;
var pkg = require('../package.json');

// only run if we're not inside an npm.script
if (!process.env['npm_config_node_version']) { // jshint ignore:line
  require('update-notifier')({
    pkg: defaults(pkg, { version: '0.0.0' }),
  }).notify();
}