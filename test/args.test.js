var test = require('tap').test;
var args = require('../src/cli/args');

test('test command line arguments', function(t) {
  t.plan(1);
  var cliArgs = [ '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--',
    '-Paxis',
    '-Pjaxen',
  ];
  var result = args(cliArgs);
  t.deepEqual(result.options._doubleDashArgs, ['-Paxis', '-Pjaxen']);
  t.end();
});

test('test command line test --package-manager', function(t) {
  t.plan(1);
  var cliArgs = [ '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--package-manager=pip',
  ];
  var result = args(cliArgs);
  t.equal(result.options.packageManager, 'pip');
  t.end();
});

test('test command line monitor --package-manager', function(t) {
  t.plan(1);
  var cliArgs = [ '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'monitor',
    '--package-manager=pip',
  ];
  var result = args(cliArgs);
  t.equal(result.options.packageManager, 'pip');
  t.end();
});

test('test --insecure', function(t) {
  t.plan(1);
  t.teardown(function () {
    delete global.ignoreUnknownCA;
  });
  var cliArgs = [ '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--insecure',
  ];
  var result = args(cliArgs);
  t.equal(global.ignoreUnknownCA, true, 'ignoreUnknownCA true');
  t.end();
});
