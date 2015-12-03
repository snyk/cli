var test = require('tape');

test('can be loaded twice', function (t) {
  var config = require('../')(__dirname + '/fixtures/one');
  t.equal(config.foo, 1, 'config matches');
  t.equal(config.bar, 2, 'config matches');

  var config2 = require('../')(__dirname + '/fixtures/two');
  t.equal(config2.foo, 10, 'config2 matches');
  t.equal(config2.bar, 20, 'config2 matches');

  t.end();
});

test('env values override', function (t) {
  process.env.SNYK_foo = 100; // jshint ignore:line
  process.env.SNYK_bar__foo = 200; // jshint ignore:line
  process.env.PORT = 8888; // jshint ignore:line
  var config = require('../')(__dirname + '/fixtures/one');

  t.equal(config.foo, '100', 'config matches');
  t.deepEqual(config.bar, { foo: '200' }, 'object matches');

  process.env = {};
  t.end();
});

test('can be called without a path', function (t) {
  t.ok(require('../')(__dirname), 'config loaded without a path');
  t.end();
});

test('env truthy correctly parsed', function (t) {
  process.env.SNYK_foo = 'TRUE'; // jshint ignore:line
  process.env.SNYK_bar = 'FALSE'; // jshint ignore:line
  process.env.SNYK_zoo = 'false'; // jshint ignore:line

  var config = require('../')(__dirname + '/fixtures/one');

  t.equal(config.foo, true, 'truth config matches');
  t.equal(config.bar, false, 'false config matches');
  t.equal(config.zoo, 'false', 'strings left as is');

  process.env = {};

  t.end();
});

test('arg truthy correctly parsed', function (t) {
  var config = require('../')(__dirname + '/fixtures/one');

  t.equal(config.afoo, true, 'truth config matches');
  t.ok(!config.abar, 'false config matches');
  t.equal(config.azoo, 'true', 'strings left as is');

  t.end();
});