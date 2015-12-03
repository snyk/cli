/*
 * provider-argv.js: Test fixture for using yargs defaults with nconf.
 *
 * (C) 2011, Charlie Robbins and the Contributors.
 *
 */

var nconf = require('../../../lib/nconf');

var provider = new (nconf.Provider)().argv();

process.stdout.write(provider.get('something'));
