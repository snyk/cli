const minimist = require('minimist');

const argv = minimist(process.argv.slice(2));
console.log('parsed', argv);

module.exports = argv;
