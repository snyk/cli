var test = require('tap-only');
var fs = require('then-fs');
var dir = __dirname + '/fixtures/bugs/SC-1615/';
var before = test;

before('setup: ensure node_modules does not exist', t => {
  fs.rmdir(dir + '/node_modules').catch(e => {});
  t.end();
});

test('throws when missing node_modules', t => {
  var snyk = require('../src/lib');
  return snyk.test(dir).then(() => {
    t.fail('should have thrown');
  }).catch(e => {
    t.matches(e.message, /Missing node_modules folder/);
  });
});

test('is able to test root level vulns', t => {
  var snyk = require('../src/lib');
  process.chdir(dir);
  return fs.mkdir('node_modules').then(() => {
    return snyk.test(process.cwd()).then(res => {
      t.notOk(res.ok);
    }).catch(e => {
      t.fail(e); // catch because we want to clean up
    });
  }).then(() => {
    return fs.rmdir(process.cwd() + '/node_modules');
  });
});
