import { test } from 'tap';
import { args } from '../src/cli/args';

test('test command line arguments', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--',
    '-Paxis',
    '-Pjaxen',
  ];
  const result = args(cliArgs);
  t.deepEqual(result.options._doubleDashArgs, ['-Paxis', '-Pjaxen']);
  t.end();
});

test('test command line test --package-manager', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--package-manager=pip',
  ];
  const result = args(cliArgs);
  t.equal(result.options.packageManager, 'pip');
  t.end();
});

test('test command line monitor --package-manager', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'monitor',
    '--package-manager=pip',
  ];
  const result = args(cliArgs);
  t.equal(result.options.packageManager, 'pip');
  t.end();
});

test('test --insecure', (t) => {
  t.teardown(() => {
    delete (global as any).ignoreUnknownCA;
  });
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--insecure',
  ];
  const result = args(cliArgs);
  t.equal((global as any).ignoreUnknownCA, true, 'ignoreUnknownCA true');
  t.end();
});

test('test command line test --all-sub-projects', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--all-sub-projects',
  ];
  const result = args(cliArgs);
  t.ok(result.options.allSubProjects);
  t.end();
});

test('test command line test --gradle-sub-project=foo', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--gradle-sub-project=foo',
  ];
  const result = args(cliArgs);
  t.equal(result.options.subProject, 'foo');
  t.end();
});

test('test command line test --strict-out-of-sync', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--strict-out-of-sync',
  ];
  const result = args(cliArgs);
  t.equal(result.options.strictOutOfSync, true);
  t.end();
});

test('test command line test --strict-out-of-sync=true', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--strict-out-of-sync=true',
  ];
  const result = args(cliArgs);
  t.equal(result.options.strictOutOfSync, true);
  t.end();
});

test('test command line test --strict-out-of-sync=false', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--strict-out-of-sync=false',
  ];
  const result = args(cliArgs);
  t.equal(result.options.strictOutOfSync, false);
  t.end();
});

test('test command line test --fail-on=foo', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--fail-on=foo',
  ];
  const result = args(cliArgs);
  t.equal(result.options.failOn, 'foo');
  t.end();
});

test('test command line test --docker', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--docker',
  ];
  const result = args(cliArgs);
  t.ok(result.options.docker);
  t.end();
});

test('test command line test --container', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'test',
    '--container',
  ];
  const result = args(cliArgs);
  t.ok(result.options.docker);
  t.notOk(result.options.container);
  t.end();
});

test('test command line "container test"', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'container',
    'test',
  ];
  const result = args(cliArgs);
  t.ok(result.options.docker);
  t.end();
});

test('test command line "container monitor"', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'container',
    'monitor',
  ];
  const result = args(cliArgs);
  t.ok(result.options.docker);
  t.end();
});

test('test command line "container protect"', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'container',
    'protect',
  ];
  const result = args(cliArgs);
  t.notOk(result.options.docker);
  t.end();
});

test('test command line "container" should display help for mode', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'container',
  ];
  const result = args(cliArgs);
  t.equal(result.command, 'help', 'command should be replaced by help');
  t.equal(
    result.options.help,
    'container',
    'help option should be assigned to container',
  );
  t.end();
});

test('test command line "container --help" should display help for mode', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'container',
    '--help',
  ];
  const result = args(cliArgs);
  t.equal(result.command, 'help', 'command should be replaced by help');
  t.equal(
    result.options.help,
    'container',
    'help option should be assigned to container',
  );
  t.end();
});

test('test command line "container test --help" should display help for mode', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'container',
    'test',
    '--help',
  ];
  const result = args(cliArgs);
  t.equal(result.command, 'help', 'command should be replaced by help');
  t.equal(
    result.options.help,
    'container',
    'help option should be assigned to container',
  );
  t.end();
});
