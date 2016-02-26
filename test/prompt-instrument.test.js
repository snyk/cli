var test = require('tap').test;
var tryRequire = require('snyk-try-require');
var interactive = require('./wizard-instrumented');

test('wizard prompts as expected', function (t) {
  t.plan(2);
  t.test('groups correctly (with oui package)', function (t) {
    var responses = [ // 17
      'default:patch',
      'default:patch',
      'default:patch', // 4
      'default:patch', // 2
      'default:patch', // 2
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      false,
      false,];

    var vulns = require(__dirname + '/fixtures/oui.json');

    interactive(vulns, responses).then(function () {
      // console.log(res);
      t.pass('ok');
    }).catch(t.threw).then(t.end);
  });

  t.test('includes shrinkwrap when updating', function (t) {
    var responses = [ //
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

    tryRequire(__dirname + '/fixtures/pkg-mean-io/package.json').then(function (pkg) {
      var options = {
        pkg: pkg,
      };

      return interactive(vulns, responses, options).then(function (res) {
        t.ok(res['misc-build-shrinkwrap'], 'shrinkwrap is present');
      });
    }).catch(t.threw).then(t.end);

  });
});