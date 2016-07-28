module.exports = filter;

var prune = require('../lib/prune');
var colour = require('ansicolors');
var semver = require('semver');
var toObject = require('snyk-module');

// warning - mutates
function filter(options, tree) {
  var apply = true;
  var match = typeof options.filter === 'string' ? toObject(options.filter) :
    null;

  if (!match) {
    apply = filter.flags.some(function (flag) {
      return options[flag];
    });
  }

  if (!apply) {
    return;
  }

  prune(tree, function (dep) {
    var bundled = !options.bundled;
    var extraneous = !options.extraneous;
    var shrinkwrap = !options.shrinkwrap;

    if (options.bundled && dep.bundled) {
      bundled = Object.keys(dep.dependencies || {}).length === 0;
    }

    if (options.extraneous && dep.extraneous) {
      extraneous = Object.keys(dep.dependencies || {}).length === 0;
    }

    if (options.shrinkwrap && dep.shrinkwrap) {
      shrinkwrap = Object.keys(dep.dependencies || {}).length === 0;
    }

    if (!match) {
      return !(bundled && extraneous && shrinkwrap);
    }

    if (dep.name === match.name) {
      if (semver.satisfies(dep.version, match.version)) {
        // if we're not colouring, then we'll highlight match
        if (!options.count) {
          dep.full = colour.bgGreen(colour.black(dep.full));
        }

        // false if it has all the requirements
        return !(
          (bundled || options.bundled && dep.bundled) &&
          (extraneous || options.extraneous && dep.extraneous) &&
          (shrinkwrap || options.shrinkwrap && dep.shrinkwrap) &&
          true);
      }

      return true; // prune
    }

    return true;
  });
}

filter.flags = ['bundled', 'extraneous', 'shrinkwrap'];