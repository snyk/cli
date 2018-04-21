var policy = require('snyk-policy');
var test = require('tap').test;
var fs = require('then-fs');
var chalk = require('chalk');
var display = require('../lib/display-policy');

test('test sensibly bails if gets an old .snyk format', function (t) {

  t.plan(1);
  var filename = __dirname + '/fixtures/snyk-config-no-version';
  var promises = [
    policy.load(filename).then(display),
    fs.readFile(filename + '/expected', 'utf8'),
  ];

  Promise.all(promises).then(function (res) {
    // strip the first 3 lines from each result
    var result = chalk.stripColor(res[0]).trim().split('\n').slice(3).join('\n');
    var expected = res[1].trim().split('\n').slice(3).join('\n');
    t.equal(result, expected);
  }).catch(t.threw);
});
