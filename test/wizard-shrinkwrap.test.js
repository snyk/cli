var test = require('tap').test;
var tryRequire = require('snyk-try-require');
var interactive = require('./wizard-instrumented');

test('wizard detects shrinkwrap', function (t) {
  t.plan(2);

  t.test('includes shrinkwrap when updating', function (t) {
    var responses = [ //
      'default:update', // 7
      'default:update', // 3
      'default:update', // 1
      'default:update', // 5
      'default:update', // 1
      'default:update', // 2
      'default:patch', // 2
      'skip', // FIXME should be patch, but it's upgrade
      'default:patch', // 1
      'default:patch', // 1
      'default:patch', // 2
      true,];

    var vulns = require(__dirname + '/fixtures/mean.json');

    tryRequire(__dirname + '/fixtures/pkg-mean-io/package.json').then(function (pkg) {
      var options = {
        pkg: pkg,
      };

      return interactive(vulns, responses, options).then(function (res) {
        t.ok(res['misc-build-shrinkwrap'], 'shrinkwrap is present');
      });
    }).catch(t.threw).then(t.end);

  });

  t.test('omits shrinkwrap when NOT updating', function (t) {
    var responses = [ //
      'skip', // 7
      'skip', // 3
      'skip', // 1
      'skip', // 5
      'skip', // 1
      'skip', // 2
      'default:patch', // 2
      'skip', // FIXME should be patch, but it's upgrade
      'default:patch', // 1
      'default:patch', // 1
      'default:patch', // 2
      true,];

    var vulns = require(__dirname + '/fixtures/mean.json');

    tryRequire(__dirname + '/fixtures/pkg-mean-io/package.json').then(function (pkg) {
      var options = {
        pkg: pkg,
      };

      return interactive(vulns, responses, options).then(function (res) {
        t.notEqual(res['misc-build-shrinkwrap'], true, 'shrinkwrap is not present');
      });
    }).catch(t.threw).then(t.end);

  });
});