var test = require('tap').test;
var interactive = require('./wizard-instrumented');

test('wizard prompts as expected', function (t) {
  t.test('groups correctly (with oui package)', function (t) {
    var responses = [
      'default:update',
      'default:patch',
      'default:patch',
      'default:patch',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore',
      'none given',
      'default:ignore'];

    var vulns = require(__dirname + '/fixtures/oui.json');

    interactive(vulns, responses).then(function (res) {
      // console.log(res);
      t.pass('ok');
    }).catch(t.threw).then(t.end);
  });
});