const test = require('tap-only');
const fs = require('then-fs');
const dir = __dirname + '/fixtures/bugs/SC-1615/';

test('throws when missing node_modules', t => {
  var snyk = require('../');
  return snyk.test(dir).then(() => {
    t.fail('should have thrown');
  }).catch(e => {
    t.matches(e.message, /Missing node_modules folder/);
  });
});

test('is able to test root level vulns', t => {
  var snyk = require('../');
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
