module.exports = attachNotes;

var debug = require('debug')('snyk:policy');
var matchToRule = require('../match').matchToRule;

function attachNotes(notes, vuln) {
  if (!notes) {
    return vuln;
  }
  debug('attaching notes');
  var now = (new Date()).toJSON();

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
