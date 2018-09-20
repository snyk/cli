var cli = require('../src/cli/commands/');
var test = require('tap').test;

var urls = [
  // a repo with no dependencies so it will never be vulnerable (2017-05-15)
  'https://github.com/Snyk/vulndb-fixtures',
  'https://github.com/Snyk/vulndb-fixtures.git',
  'git@github.com:Snyk/vulndb-fixtures.git',
  'Snyk/vulndb-fixtures.git',
];

urls.forEach(function (url) {
  test('snyk.test supports ' + url + ' structure', function (t) {
    cli.test(url).then(function () {
      t.pass('url worked');
    }).catch(t.threw).then(t.end);
  });
});
