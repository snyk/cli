const path = require('path');
const test = require('tap').test;

const subProcess = require('../../src/lib/sub-process');

let scriptDir;
let scriptExtension;
let shellVar;

if (process.platform === 'win32') {
  scriptDir = 'windows';
  scriptExtension = '.bat';
  shellVar = '%PATHEXT%';
} else {
  scriptDir = 'posix';
  scriptExtension = '.sh';
  shellVar = '$SHLVL';
}

function script(name) {
  return path.join(
    __dirname,
    'support',
    'scripts',
    scriptDir,
    name + scriptExtension,
  );
}

function isSupported() {
  /**
   * The 'shell' option for spawn is only supported on Node >= 6
   * This is a temporary solution to get the build to succeed.
   * We need to add the proper checks (node version, mvn version, platform)
   * and fall back to exec (or appending '.cmd') for Node < 6 on Windows.
   */
  try {
    const supportedNodeVersion = 6;
    const majorVersion = Number(process.version.match(/^v([\d]+)/)[1]);
    return majorVersion >= supportedNodeVersion;
  } catch (err) {
    return false;
  }
}

test('sub-process.execute executes sub processes', function(t) {
  if (isSupported()) {
    t.test('runs in shell', function(t) {
      t.plan(1);

      subProcess
        .execute('echo', [shellVar])
        .then(function(result) {
          t.not(result.trim(), shellVar, 'evaluates shell variable');
        })
        .catch(t.fail);
    });
  }

  t.test('successful execution', function(t) {
    t.plan(2);

    subProcess
      .execute(script('stdout-echo'), ['hello world'])
      .then(function(result) {
        t.match(result, 'hello world', 'should resolve with stdout');
      })
      .catch(t.fail);

    subProcess
      .execute(script('stderr-echo'), ['hello error'])
      .then(function(result) {
        t.match(result, 'hello error', 'should resolve with stderr');
      })
      .catch(t.fail);
  });

  t.test('error during execution', function(t) {
    t.plan(2);

    subProcess
      .execute(script('stdout-echo-fail'), ['hello world'])
      .then(function() {
        t.fail('should not have resolved');
      })
      .catch(function(err) {
        t.match(err, 'hello world', 'should reject with standard output');
      });

    subProcess
      .execute(script('stderr-echo-fail'), ['hello error'])
      .then(function() {
        t.fail('should not have resolved');
      })
      .catch(function(err) {
        t.match(
          err,
          'hello error',
          'should reject with standard error, if no standard output',
        );
      });
  });

  t.test('options', function(t) {
    t.test('options.cwd', function(t) {
      t.plan(2);

      const explicitWorkDir = path.resolve(path.join(__dirname, 'support'));
      subProcess
        .execute(script('pwd'), [], { cwd: explicitWorkDir })
        .then(function(result) {
          t.match(result, explicitWorkDir, 'specifies the working directory');
        })
        .catch(t.fail);

      const currentWorkDir = process.cwd();
      subProcess
        .execute(script('pwd'), [])
        .then(function(result) {
          t.match(
            result,
            currentWorkDir,
            'defaults to the current working directory',
          );
        })
        .catch(t.fail);
    });

    t.end();
  });

  t.end();
});
