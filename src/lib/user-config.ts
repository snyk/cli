const Configstore = require('configstore');
const pkg = require(__dirname + '/../../package.json');
export const config = new Configstore(pkg.name);
