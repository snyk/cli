import { test } from 'tap';
import * as snyk from '../src/lib';

test('api token', (t) => {
  const fromConfig = snyk.config.get('api');
  t.equal(fromConfig, snyk.api, 'current api value matches config store');
  const value = '_____test_____';
  snyk.config.set('api', value);
  t.equal(value, snyk.api, 'dynamically set value is correct');
  if (fromConfig !== undefined) {
    snyk.config.set('api', fromConfig);
  } else {
    snyk.config.delete('api');
  }
  t.end();
});

test('api token via env value', (t) => {
  const fromConfig = snyk.config.get('api');
  t.equal(fromConfig, snyk.api, 'current api value matches config store');
  const value = '_____test_____';
  snyk.config.set('api', value);
  t.equal(value, snyk.api, 'dynamically set value is correct');
  if (fromConfig !== undefined) {
    snyk.config.set('api', fromConfig);
  } else {
    snyk.config.delete('api');
  }
  t.end();
});
