module.exports = getSettings;

const debug = require('debug')('clite');
const mergeWith = require('lodash.mergewith');

function getSettings(options) {
  var settings = {};
  var defaults = require('./defaults')();
  checkFor('version', options, defaults);
  checkFor('help', options, defaults);

  mergeWith(settings, defaults, options, customizer);
  return settings;
}

function customizer(obj, src) {
  if (Array.isArray(obj)) {
    return obj.concat(src);
  }
}

function checkFor(key, config, defaults) {
  if (!config) {
    config = {};
  }

  if ((config.booleans || []).indexOf(key) === -1) {
    return;
  }

  debug('stripping internal command: %s', key);

  delete defaults.commands[key];
  defaults.booleans.splice(defaults.booleans.indexOf(key), 1);
}