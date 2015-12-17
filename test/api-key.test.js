var test = require('tape');
var snyk = require('../lib');

test('api key', function (t) {
  var fromConfig = snyk.config.get('api');
  console.log(fromConfig);
  t.equal(fromConfig, snyk.api, 'current api value matches config store');
  var value = '_____test_____';
  snyk.config.set('api', value);
  t.equal(value, snyk.api, 'dynamically set value is correct');
  if (fromConfig !== undefined) {
    snyk.config.set('api', fromConfig);
  }
  t.end();
});