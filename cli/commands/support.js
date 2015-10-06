module.exports = support;

var Promise = require('es6-promise').Promise; // jshint ignore:line
var open = require('open');
var os = require('os');
var osName = require('os-name');
var version = require('./version');

function support() {
  return version().then(function (v) {
    var msg = '\nUseful information to file a new issue with:\n' +
        '\n- snyk ' + v +
        '\n- node ' + process.version +
        '\n- ' + osName(os.platform(), os.release()) +
        '\n';
    setTimeout(function () {
      open('https://github.com/snyk/support');
    }, 1000);
    return msg;
  });
}