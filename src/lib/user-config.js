const Configstore = require('configstore');
const pkg = require(__dirname + '/../../package.json');
const config = new Configstore(pkg.name);

module.exports = config;
