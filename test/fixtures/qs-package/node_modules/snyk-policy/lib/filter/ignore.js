module.exports = filterIgnored;

var debug = require('debug')('snyk:policy');
var matchToRule = require('../match').matchToRule;

// given an ignore ruleset (parsed from the .snyk yaml file) and a array of
// vulnerabilities, return the vulnerabilities that *are not* ignored
// see http://git.io/vCHmV for example of what ignore structure looks like
function filterIgnored(ignore, vuln, filtered) {
  if (!ignore) {
    return vuln;
  }

  if (!filtered) {
    filtered = [];
  }

  debug('filtering ignored');
  var now = (new Date()).toJSON();

  return vuln.map(function (vuln) {
    if (!ignore[vuln.id]) {
      return vuln;
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

    if (res) {
      filtered.push(vuln);
    }

    return res ? false : vuln;
  }).filter(Boolean);
}
