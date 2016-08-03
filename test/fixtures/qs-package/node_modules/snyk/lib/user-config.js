var Configstore = require('configstore');
var pkg = require(__dirname + '/../package.json');
var config = new Configstore(pkg.name);

module.exports = config;