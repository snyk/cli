module.exports = {
  matchToRule: matchToRule,
  getByVuln: getByVuln,
};

var debug = require('debug')('snyk:policy');
var debugPolicy = require('debug')('snyk:protect');
var semver = require('semver');
var moduleToObject = require('snyk-module');

// matchPath will take the array of dependencies that a vulnerability came from
// and try to match it to a string `path`. The path will look like this:
// express-hbs@0.8.4 > handlebars@3.0.3 > uglify-js@2.3.6
// note that the root package is never part of the path (i.e. jsbin@3.11.31)
// the path can also use `*` as a wildcard _and_ use semver:
// * > uglify-js@2.x
// The matchPath will break the `path` down into it's component parts, and loop
// through trying to get a positive match or not. For full examples of options
// see http://git.io/vCH3N
function matchPath(from, path) {
  var parts = path.split(' > ');
  debugPolicy('checking path: %s vs. %s', path, from);
  var offset = 0;
  var res = parts.every(function (pkg, i) {
    debugPolicy('for %s...(against %s)', pkg, from[i + offset]);
    var fromPkg = from[i + offset] ? moduleToObject(from[i + offset]) : {};

    if (pkg === '*') {
      debugPolicy('star rule');

      // handle the rule being `*` alone
      if (!parts[i + 1]) {
        return true;
      }

      var next = moduleToObject(parts[i + 1]);

      // assuming we're not at the end of the rule path, then try to find
      // the next matching package in the chain. So `* > semver` matches
      // `foo > bar > semver`
      if (next) {
        debugPolicy('next', next);
        // move forward until we find a matching package
        for (var j = i; i < parts.length; j++) {
          // if we've run out of paths, then we didn't match
          if (!from[i + offset]) {
            return false;
          }
          fromPkg = moduleToObject(from[i + offset]);
          debugPolicy('fromPkg', fromPkg, next);

          if (next.name === fromPkg.name) {
            // adjust for the `i` index incrementing in the next .every call
            offset--;
            debugPolicy('next has a match');
            break;
          }
          debugPolicy('pushing offset');
          offset++;
        }
      }

      return true;
    }

    debugPolicy('next test', pkg, fromPkg);

    if (pkg === from[i + offset]) {
      debugPolicy('exact match');
      return true;
    }

    // if we're missing the @version - add @* so the pkg is foobar@*
    // so we have a good semver range
    if (pkg.indexOf('@') === -1) {
      pkg += '@*';
    }

    var target = moduleToObject(pkg);

    var pkgVersion = target.version;

    // the * semver rule won't match pre-releases, which in our case is a
    // problem, so if the version is indeed *, we'll reset it to the exact same
    // version as our target package to allow for a match.
    if (pkgVersion === '*') {
      pkgVersion = fromPkg.version;
    }

    // shortcut version match, if it's exact, then skip the semver check
    if (target.name === fromPkg.name) {
      if (fromPkg.version === pkgVersion) {
        debugPolicy('exact version match');
        return true;
      }

      if (semver.valid(fromPkg.version) &&
        semver.satisfies(fromPkg.version, pkgVersion)) {
        debugPolicy('semver match');
        return true;
      }
    }


    debugPolicy('failed match');

    return false;
  });
  debugPolicy('result of path test %s: %s', path, res);
  return res;
}

function matchToRule(vuln, rule) {
  return Object.keys(rule).some(function (path) {
    return matchToSingleRule(vuln, path);
  });
}

function matchToSingleRule(vuln, path) {
  // check for an exact match
  var pathMatch = false;
  var from = vuln.from.slice(1);
  if (path.indexOf(from.join(' > ')) !== -1) {
    debug('%s exact match from %s', vuln.id, from);
    pathMatch = true;
  } else if (matchPath(from, path)) {
    pathMatch = true;
  }

  return pathMatch;
}

function getByVuln(policy, vuln) {
  var found = null;

  if (!policy || !vuln) {
    return found;
  }

  ['ignore', 'patch'].forEach(function (key) {
    Object.keys(policy[key] || []).forEach(function (p) {
      if (p === vuln.id) {
        policy[key][p].forEach(function (rule) {
          if (matchToRule(vuln, rule)) {
            found = {
              type: key,
              id: vuln.id,
              rule: vuln.from,
            };
            var rootRule = Object.keys(rule).pop();
            Object.keys(rule[rootRule]).forEach(function (key) {
              found[key] = rule[rootRule][key];
            });
          }
        });
      }
    });
  });

  return found;
}