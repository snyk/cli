#!/usr/bin/env node

var args = require('./args')(process.argv);
var debug = require('debug')('snyk');
var copy = require('./copy');

var exitcode = 0;

args.method.apply(null, args.options._).then(function (result) {
  var analytics = require('../lib/analytics');
  var res = analytics({
    command: args.command,
    args: args.options._,
  });
  if (result && !args.options.quiet) {
    if (args.options.copy) {
      copy(result);
      console.log('\nResult copied to clipboard');
    } else {
      console.log(result);
    }
  }
  return res;
}).catch(function (error) {
  var analytics = require('../lib/analytics');
  analytics.add('error', error.stack);
  var res = analytics({
    command: args.command,
    args: args.options._,
  });

  if (args.options.debug) {
    console.log(error.stack);
  } else {
    var errors = require('../lib/error');
    if (!args.options.quiet) {
      console.log(errors.message(error));
    }
  }

  exitcode = 1;
  return res;
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