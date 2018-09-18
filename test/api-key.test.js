var test = require('tape');
var snyk = require('../src/lib');

test('api token', function (t) {
  var fromConfig = snyk.config.get('api');
  t.equal(fromConfig, snyk.api, 'current api value matches config store');
  var value = '_____test_____';
  snyk.config.set('api', value);
  t.equal(value, snyk.api, 'dynamically set value is correct');
  if (fromConfig !== undefined) {
    snyk.config.set('api', fromConfig);
  } else {
    snyk.config.delete('api');
  }
  t.end();
});

test('api token via env value', function (t) {
  var fromConfig = snyk.config.get('api');
  t.equal(fromConfig, snyk.api, 'current api value matches config store');
  var value = '_____test_____';
  snyk.config.set('api', value);
  t.equal(value, snyk.api, 'dynamically set value is correct');
  if (fromConfig !== undefined) {
    snyk.config.set('api', fromConfig);
  } else {
    snyk.config.delete('api');
  }
  t.end();
});
