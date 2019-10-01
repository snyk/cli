module.exports = {
  silenceLog: silenceLog,
  extendExpiries: extendExpiries,
  tmpdir: tmpdir,
};

var osTmpdir = require('os').tmpdir;
var join = require('path').join;
var mkdirSync = require('fs').mkdirSync;

function silenceLog() {
  var old = console.log;

  console.log = function() {};

  return function() {
    console.log = old;
  };
}

function extendExpiries(policy) {
  var d = new Date(Date.now() + 1000 * 60 * 60 * 24).toJSON();
  Object.keys(policy.ignore).forEach(function(id) {
    policy.ignore[id].forEach(function(rule) {
      var path = Object.keys(rule).shift();
      rule[path].expires = d;
    });
  });
}

function tmpdir() {
  var dirname = join(
    osTmpdir(),
    'TMP' +
      Math.random()
        .toString(36)
        .replace(/[^a-z0-9]+/g, '')
        .substr(2, 12),
  );
  mkdirSync(dirname);
  return dirname;
}
