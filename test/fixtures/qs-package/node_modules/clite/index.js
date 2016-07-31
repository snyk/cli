var _ = true;
try {
  eval('_=!(o=>o)'); // jshint ignore:line
} catch (e) {
  require('es6-promise').polyfill();
}

module.exports = require(_ ? './dist' : './lib');