var test = require('tap-only');
var args = require('../cli/args');

test('test command line arguments', function(t) {
  t.plan(1);
  var cliArgs = [ '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--',
    '-Paxis',
    '-Pjaxen'
  ];
  var result = args(cliArgs);
  t.equal(result.options._doubleDashArgs, '-Paxis -Pjaxen');
});
