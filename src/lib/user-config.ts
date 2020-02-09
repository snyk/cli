const Configstore = require('@snyk/configstore');
const pkg = require(__dirname + '/../../package.json');
export const config = new Configstore(pkg.name);
