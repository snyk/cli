import { test } from 'tap';
import { args } from '../src/cli/args';
import { config as userConfig } from '../src/lib/user-config';

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
  args(cliArgs);
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
  t.ok(result.options.experimental);
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
  t.ok(result.options.experimental);
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
  t.notOk(result.options.experimental);
  t.end();
});

test('when command line "container"', (c) => {
  c.test('set option imageSavePath via config set', (t) => {
    delete process.env['SNYK_IMAGE_SAVE_PATH'];
    userConfig.set('imageSavePath', './my/custom/image/save/path');
    const cliArgs = [
      '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
      '/Users/dror/work/snyk/snyk-internal/cli',
      'container',
      'test',
    ];

    const result = args(cliArgs);

    t.equal(
      result.options.imageSavePath,
      './my/custom/image/save/path',
      'the custom path should be assigned with path',
    );
    userConfig.delete('imageSavePath');
    t.end();
  });

  c.test('set option imageSavePath via env var', (t) => {
    process.env['SNYK_IMAGE_SAVE_PATH'] = './my/custom/image/save/path';
    const cliArgs = [
      '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
      '/Users/dror/work/snyk/snyk-internal/cli',
      'container',
      'test',
    ];

    const result = args(cliArgs);

    t.equal(
      result.options.imageSavePath,
      './my/custom/image/save/path',
      'the custom path should be assigned with path',
    );
    delete process.env['SNYK_IMAGE_SAVE_PATH'];
    t.end();
  });

  c.test('does not set option imageSavePath', (t) => {
    delete process.env['SNYK_IMAGE_SAVE_PATH'];
    const cliArgs = [
      '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
      '/Users/dror/work/snyk/snyk-internal/cli',
      'container',
      'test',
    ];

    const result = args(cliArgs);

    t.notOk(
      result.options.imageSavePath,
      'the custom path should not be assigned',
    );
    t.end();
  });
  c.end();
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

test('test command line "snyk monitor --project-name-prefix" should add a property on options', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'monitor',
    '--project-name-prefix=my-prefix/',
  ];
  const result = args(cliArgs);
  t.equal(
    result.options['project-name-prefix'],
    'my-prefix/',
    'expected options[project-name-prefix] to equal expected value',
  );
  t.end();
});

test('test command line "snyk monitor --packages-folder" should add a property on options', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'monitor',
    '--packages-folder=/path/to/folder',
  ];
  const result = args(cliArgs);
  t.equal(
    result.options['packagesFolder'], // this option is camel-cased in src/cli/args.ts
    '/path/to/folder',
    'expected options[packagesFolder] to equal expected value',
  );
  t.end();
});

test('test command line "snyk monitor --assets-project-name" should add a property on options', (t) => {
  const cliArgsWithFlag = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'monitor',
    '--assets-project-name',
  ];
  const resultWithFlag = args(cliArgsWithFlag);
  t.ok(
    resultWithFlag.options['assets-project-name'],
    'expected options[assets-project-name] to be true',
  );
  const cliArgsWithoutFlag = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'monitor',
  ];
  const resultWithoutFlag = args(cliArgsWithoutFlag);
  t.notOk(
    resultWithoutFlag.options['assets-project-name'],
    'expected options[assets-project-name] to be false',
  );
  t.end();
});

test('test command line "iac" should display help for mode', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'iac',
  ];
  const result = args(cliArgs);
  t.equal(result.command, 'help', 'command should be replaced by help');
  t.equal(result.options.help, 'iac', 'help option should be assigned to iac');
  t.end();
});

test('test command line "iac --help" should display help for mode', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'iac',
    '--help',
  ];
  const result = args(cliArgs);
  t.equal(result.command, 'help', 'command should be replaced by help');
  t.equal(result.options.help, 'iac', 'help option should be assigned to iac');
  t.end();
});

test('test command line "iac test --help" should display help for mode', (t) => {
  const cliArgs = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'iac',
    'test',
    '--help',
  ];
  const result = args(cliArgs);
  t.equal(result.command, 'help', 'command should be replaced by help');
  t.equal(result.options.help, 'iac', 'help option should be assigned to iac');
  t.end();
});

test('test command line "snyk iac --experimental" should be true on options', (t) => {
  const cliArgsWithFlag = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'iac',
    '--experimental',
  ];
  const resultWithFlag = args(cliArgsWithFlag);
  t.ok(
    resultWithFlag.options['experimental'],
    'expected options[experimental] to be true',
  );
  const cliArgsWithoutFlag = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'iac',
  ];
  const resultWithoutFlag = args(cliArgsWithoutFlag);
  t.notOk(
    resultWithoutFlag.options['experimental'],
    'expected options[experimental] to be false',
  );
  t.end();
});

test('test command line "snyk iac --experimental --detection-depth=1" should be 1 on options', (t) => {
  const cliArgsWithFlag = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'iac',
    '--experimental',
    '--detection-depth=1',
  ];
  const resultWithFlag = args(cliArgsWithFlag);
  t.equal(
    resultWithFlag.options['detectionDepth'],
    1,
    'expected options[detectionDepth] to be 1',
  );
  const cliArgsWithoutFlag = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'iac',
    '--experimental',
  ];
  const resultWithoutFlag = args(cliArgsWithoutFlag);
  t.equal(
    resultWithoutFlag.options['detectionDepth'],
    undefined,
    'expected options[detectionDepth] to be undefined',
  );
  t.end();
});

test('test command line "snyk iac test --rules=./path/to/bundle.tar.gz" should have path on options', (t) => {
  const cliArgsWithFlag = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'iac',
    'test',
    '--experimental',
    '--rules=./path/to/bundle.tar.gz',
  ];
  const resultWithFlag = args(cliArgsWithFlag);
  t.equal(
    resultWithFlag.options['rules'],
    './path/to/bundle.tar.gz',
    'expected options[rules] to be ./path/to/bundle.tar.gz',
  );
  const cliArgsWithoutFlag = [
    '/Users/dror/.nvm/versions/node/v6.9.2/bin/node',
    '/Users/dror/work/snyk/snyk-internal/cli',
    'iac',
    'test',
  ];
  const resultWithoutFlag = args(cliArgsWithoutFlag);
  t.equal(
    resultWithoutFlag.options['rules'],
    undefined,
    'expected options[rules] to be undefined',
  );
  t.end();
});
