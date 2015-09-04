var snyk = require('../../');
var Promise = require('es6-promise').Promise; // jshint ignore:line

module.exports = function (path) {
  return snyk.test(path || process.cwd()).then(function (res) {
    if (res.ok) {
      return '✓ No vulnerabilities found';
    }

    throw new Error(res.vulnerabilities.map(function (vuln) {
      var name = vuln.name + '@' + vuln.version;
      var res = '✗ vulnerability found on ' + name + '\n';

      res += 'From: ' + vuln.from.join(' > ') + '\n';
      res += 'Info: ' + vuln.info.join(', ');
      res += '\n';

      var upgradeSteps = (vuln.upgradePath || []).filter(Boolean);

      // Remediation instructions (if we have one)
      if (upgradeSteps.length) {

        // Create upgrade text
        var upgradeText = upgradeSteps.shift();
        upgradeText += (upgradeSteps.length)?'':' (triggers upgrades to ' + upgradeSteps.join(' > ') + ')';


        res += 'Fix : ';
        for(var idx=0; idx<vuln.upgradePath.length; idx++)
        {
          var elem = vuln.upgradePath[idx];

          if (elem) {
            // Check if we're suggesting to upgrade to ourselves.
            if (vuln.from.length > idx && vuln.from[idx] === elem) {
              // This version should get the not-vulnerable dependency, suggest a refresh
              res += 'Your dependencies are out of date. Delete node_modules and reinstall, should trigger an upgrade to ' + upgradeText +
                '. If you\'re using a private repsository, ensure it\'s up to date.';
              break;
            }
            switch (idx) {
              case 0:
                // First elem is non-false, means you're in an outdated version of yourself
                res += 'You\'ve tested an outdated version of the project. Should be upgraded to ' + upgradeText;
                break;
              case 1:
                // Second elem is non-false, means a direct dependency needs upgrade. Nothing to add.
                res += 'Upgrade direct dependency ' + upgradeText;
                break;
              default:
                // Later item is non-false, means a deep dependency needs to be upgraded
                res += 'Manually upgrade deep dependency ' + upgradeText;
                break;
            }
            break;
          }
        }
      } else {
        res += 'Fix: None available. Consider not using this dependency.';
      }
      return res;
    }).join('\n\n'));
  });
};
