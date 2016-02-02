var cli = require('../cli/commands/');
var test = require('tap').test;

var urls = [
  'https://github.com/remy/undefsafe',
  'https://github.com/remy/undefsafe.git',
  'git@github.com:remy/undefsafe.git',
  'remy/undefsafe',
];

urls.forEach(function (url) {
  test('snyk.test supports ' + url + ' structure', function (t) {
    cli.test(url).then(function () {
      t.pass('url worked');
    }).catch(t.threw).then(t.end);
  });
});