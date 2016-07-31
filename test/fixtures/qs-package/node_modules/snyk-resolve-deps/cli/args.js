module.exports = args;

var minimist = require('minimist');
var abbrev = require('abbrev');

function args(argv, strings, booleans) {
  var alias = abbrev(strings.concat(booleans));
  alias.e = 'extraneous';

  strings.forEach(function (t) {
    delete alias[t];
  });

  return minimist(argv, {
    boolean: booleans,
    string: strings,
    alias: alias,
  });
}

