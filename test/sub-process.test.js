var path = require('path');
var test = require('tap').test;

var subProcess = require('../lib/sub-process');

var scriptDir;
var scriptExtension;

if (process.platform === 'win32') {
  scriptDir = 'windows';
  scriptExtension = '.bat';
} else {
  scriptDir = 'posix';
  scriptExtension = '.sh';
}

function script(name) {
  return path.join(__dirname, 'support', 'scripts', scriptDir,
    name + scriptExtension);
}

test('sub-process.execute executes sub processes', function (t) {
  t.test('successful execution', function (t) {
    t.plan(2);

    subProcess.execute(script('stdout-echo'), ['hello world'])
      .then(function (result) {
        t.equal(result.stdout, 'hello world', 'should resolve with stdout');
      })
      .catch(t.fail);

    subProcess.execute(script('stderr-echo'), ['hello error'])
      .then(function (result) {
        t.equal(result.stderr, 'hello error', 'should resolve with stderr');
      })
      .catch(t.fail);
  });

  t.test('error during execution', function (t) {
    t.plan(2);

    subProcess.execute(script('stdout-echo-fail'), ['hello world'])
      .then(function () {
        t.fail('should not have resolved');
      })
      .catch(function (err) {
        t.equal(err, 'hello world', 'should reject with standard output');
      });

    subProcess.execute(script('stderr-echo-fail'), ['hello error'])
      .then(function () {
        t.fail('should not have resolved');
      })
      .catch(function (err) {
        t.equal(err, 'hello error',
          'should reject with standard error, if no standard output');
      });
  });

  t.test('options', function (t) {
    t.test('options.cwd', function (t) {
      t.plan(2);

      var explicitWorkDir = path.resolve(path.join(__dirname, 'support'));
      subProcess.execute(script('pwd'), [], { cwd: explicitWorkDir })
        .then(function (result) {
          t.match(result.stdout, explicitWorkDir,
            'specifies the working directory');
        })
        .catch(t.fail);

      var currentWorkDir = process.cwd();
      subProcess.execute(script('pwd'), [])
        .then(function (result) {
          t.match(result.stdout, currentWorkDir,
            'defaults to the current working directory');
        })
        .catch(t.fail);
    });

    t.end();
  });

  t.end();
});
