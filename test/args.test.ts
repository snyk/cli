import { test } from 'tap';
import { args } from '../src/cli/args';

test('test command line arguments', (t) => {
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

test('test command line test --package-manager', (t) => {
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

test('test command line test --all-sub-projects', async (t) => {
  var cliArgs = [ 'node',
    'snyk/dist/index.js',
    'test',
    '--all-sub-projects',
  ];
  var result = args(cliArgs);
  t.ok(result.options.allSubProjects);
});

test('test command line monitor --package-manager', (t) => {
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

test('test --insecure', (t) => {
  t.plan(1);
  t.teardown(function () {
    delete (global as any).ignoreUnknownCA;
  });
  var cliArgs = [ '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--insecure',
  ];
  var result = args(cliArgs);
  t.equal((global as any).ignoreUnknownCA, true, 'ignoreUnknownCA true');
  t.end();
});
