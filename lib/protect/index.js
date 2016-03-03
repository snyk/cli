var protect = module.exports = {
  ignore: require('./ignore'),
  update: require('./update'),
  patch: require('./patch'),
  patchesForPackage: require('./patches-for-package'),
  generatePolicy: generatePolicy,
  filterIgnored: filterIgnored,
  filterPatched: filterPatched,
  attachNotes: attachNotes,
};

var debug = require('debug')('snyk');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var statSync = require('fs').statSync;
var path = require('path');
var _ = require('lodash');
var matchToRule = require('../policy/match').matchToRule;
var getVulnSource = require('./get-vuln-source');

// given an ignore ruleset (parsed from the .snyk yaml file) and a array of
// vulnerabilities, return the vulnerabilities that *are not* ignored
// see http://git.io/vCHmV for example of what ignore structure looks like
function filterIgnored(ignore, vuln) {
  if (!ignore) {
    return vuln;
  }
  debug('filtering ignored');
  var now = Date.now();

  return vuln.map(function (vuln) {
    if (!ignore[vuln.id]) {
      return vuln;
    }

    // this is a cursory test to ensure that we're working with a snyk format
    // that we recognise. if the property is an object, then it's the early
    // alpha format, and we'll throw
    if (!Array.isArray(ignore[vuln.id])) {
      var error = new Error('old, unsupported .snyk format detected');
      error.code = 'OLD_DOTFILE_FORMAT';
      throw error;
    }

    debug('%s has rules', vuln.id);

    // logic: loop through all rules (from `ignore[vuln.id]`), and if *any* dep
    // paths match our vuln.from dep chain AND the rule hasn't expired, then the
    // vulnerability is ignored. if none of the rules match, then let we'll
    // keep it.

    // if rules.some, then ignore vuln
    var res = ignore[vuln.id].some(function (rule) {
      var path = Object.keys(rule)[0]; // this is a string
      var expires = rule[path].expires;

      // first check if the path is a match on the rule
      var pathMatch = matchToRule(vuln, rule);

      if (pathMatch && expires < now) {
        debug('%s vuln rule has expired (%s)', vuln.id, expires);
        return false;
      }

      if (pathMatch) {
        debug('ignoring based on path match: %s ~= %s', path,
          vuln.from.slice(1).join(' > '));
        return true;
      }

      return false;
    });

    return res ? false : vuln;
  }).filter(Boolean);
}


function attachNotes(notes, vuln) {
  if (!notes) {
    return vuln;
  }
  debug('attaching notes');
  var now = Date.now();

  return vuln.map(function (vuln) {
    if (!notes[vuln.id]) {
      return vuln;
    }

    debug('%s has rules', vuln.id);

    // if rules.some, then add note to the vuln
    notes[vuln.id].forEach(function (rule) {
      var path = Object.keys(rule)[0]; // this is a string
      var expires = rule[path].expires;

      // first check if the path is a match on the rule
      var pathMatch = matchToRule(vuln, rule);

      if (pathMatch && expires < now) {
        debug('%s vuln rule has expired (%s)', vuln.id, expires);
        return false;
      }

      if (pathMatch) {
        // strip any control characters in the 3rd party reason file
        var reason = rule[path].reason.replace('/[\x00-\x1F\x7F-\x9F]/u', '');
        debug('adding note based on path match: %s ~= %s', path,
          vuln.from.slice(1).join(' > '));
        vuln.note = 'Snyk policy in ' + rule[path].from +
          ' suggests ignoring this issue, with reason: ' + reason;
      }

      return false;
    });

    return vuln;
  });
}

// cwd is used for testing
function filterPatched(patched, vuln, cwd) {
  if (!patched) {
    return vuln;
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
      var source = getVulnSource(vuln, cwd, true);

      var flag = path.resolve(source, '.snyk-' + vuln.id + '.flag');
      var res = false;
      try {
        res = statSync(flag);
      } catch (e) {}

      debug('flag found for %s? %s', vuln.id, !!res);

      return !!res;
    });

    return res ? false : vuln;
  }).filter(Boolean);
}

function generatePolicy(policy, tasks, live) {
  var promises = ['ignore', 'update', 'patch'].filter(function (task) {
    return tasks[task].length;
  }).map(function (task) {
    return protect[task](tasks[task], live);
  });

  return Promise.all(promises).then(function (res) {
    // we're squashing the arrays of arrays into a flat structure
    // with only non-false values
    var results = _.flattenDeep(res).filter(Boolean);

    // then we merge the configs together using the original config
    // as the baseline (this lets us retain the user's existing config)
    results.unshift(policy);
    var newPolicy = _.merge.apply(_, results);

    debug(JSON.stringify(newPolicy, '', 2));

    return newPolicy;
  });
}