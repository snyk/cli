/*
 * provider-argv.js: Test fixture for using process.env defaults with nconf.
 *
 * (C) 2011, Charlie Robbins and the Contributors.
 *
 */

var nconf = require('../../../lib/nconf');

var provider = new (nconf.Provider)().env();

process.stdout.write(provider.get('SOMETHING'));