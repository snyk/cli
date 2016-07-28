var _ = true;
try {
  eval('_=!(o=>o)'); // jshint ignore:line
} catch (e) {
  require('es6-promise');
}

module.exports = _;