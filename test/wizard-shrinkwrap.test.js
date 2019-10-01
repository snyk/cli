var test = require('tap').test;
var tryRequire = require('snyk-try-require');
var interactive = require('./wizard-instrumented');

test('wizard detects shrinkwrap', function(t) {
  t.plan(1);

  t.test('includes shrinkwrap when updating', function(t) {
    var responses = [
      //
      'default:update', // 7
      'default:update', // 3
      'default:update', // 1
      'default:update', // 5
      'default:update', // 1
      'default:update', // 2
      'default:patch', // 2
      'default:patch', // 1
      'default:patch', // 1
      'default:patch', // 2
    ];

    var vulns = require(__dirname + '/fixtures/mean.json');

    tryRequire(__dirname + '/fixtures/pkg-mean-io/package.json')
      .then(function(pkg) {
        var options = {
          pkg: pkg,
        };

        return interactive(vulns, responses, options).then(function(res) {
          t.ok(res['misc-build-shrinkwrap'], 'shrinkwrap is present');
        });
      })
      .catch(t.threw)
      .then(t.end);
  });
});
