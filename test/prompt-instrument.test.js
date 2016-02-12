var test = require('tap').test;
var interactive = require('./wizard-instrumented');

test('wizard prompts as expected', function (t) {
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

  t.end();
});