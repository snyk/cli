module.exports = filterPatched;

var debug = require('debug')('snyk:policy');
var matchToRule = require('../match').matchToRule;
var path = require('path');
var statSync = require('fs').statSync;
var getVulnSource = require('./get-vuln-source');

// cwd is used for testing
function filterPatched(patched, vuln, cwd, skipVerifyPatch, filteredPatches) {
  if (!patched) {
    return vuln;
  }

  if (!filteredPatches) {
    filteredPatches = [];
  }


  debug('filtering patched');
  return vuln.map(function (vuln) {
    if (!patched[vuln.id]) {
      return vuln;
    }

    debug('%s has rules', vuln.id);

    // logic: loop through all rules (from `patched[vuln.id]`), and if *any* dep
    // paths match our vuln.from dep chain AND a flag exists, then the
    // vulnerability is ignored. if none of the rules match, then let we'll
    // keep it.

    // if rules.some, then ignore vuln
    var filtered = patched[vuln.id].map(function (rule) {

      // first check if the path is a match on the rule
      var pathMatch = matchToRule(vuln, rule);

      if (pathMatch) {
        var path = Object.keys(rule)[0]; // this is a string
        debug('(patch) ignoring based on path match: %s ~= %s', path,
          vuln.from.slice(1).join(' > '));
        return vuln;
      }

      return false;
    }).filter(Boolean);

    // run through the potential rules to check if there's a patch flag in place
    var res = filtered.some(function (vuln) {
      // the target directory where our module name will live
      if (skipVerifyPatch) {
        return true;
      }

      var source = getVulnSource(vuln, cwd, true);

      var id = vuln.id.replace(/:/g, '-');
      var flag = path.resolve(source, '.snyk-' + id + '.flag');
      var oldFlag = path.resolve(source, '.snyk-' + vuln.id + '.flag');
      var res = false;
      try {
        res = statSync(flag);
      } catch (e) {
        try {
          res = statSync(oldFlag);
        } catch (e) {}
      }

      debug('flag found for %s? %s', vuln.id);

      return !!res;
    });

    if (res) {
      filteredPatches.push(vuln);
    }

    return res ? false : vuln;
  }).filter(Boolean);
}
