var test = require('tap').test;
var args = require('../src/cli/args').args;

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
  t.equal(global.ignoreUnknownCA, true, 'ignoreUnknownCA true')
  t.end();
});


test('test command line test --all-sub-projects', function(t) {
  t.plan(1);
  var cliArgs = [ '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--all-sub-projects',
  ];
  var result = args(cliArgs);
  t.ok(result.options.allSubProjects);
  t.end();
});

test('test command line test --gradle-sub-project=foo', function(t) {
  t.plan(1);
  var cliArgs = [ '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--gradle-sub-project=foo',
  ];
  var result = args(cliArgs);
  t.equal(result.options.subProject, 'foo');
  t.end();
});
