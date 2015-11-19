#!/usr/bin/env node

var args = require('./args')(process.argv);
var debug = require('debug')('snyk');

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
  process.exit(1);
}).catch(function (e) {
  console.log('super fail', e);
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