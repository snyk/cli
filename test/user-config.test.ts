import { test } from 'tap';
import config from '../src/cli/commands/config';

test('can unset config values', async (t) => {
  let before: string | null = null;

  config('get').catch(t.pass);
  config('unset').catch(t.pass);
  config('foo' as any).catch(t.pass);

  await config()
    .then(function(v) {
      before = v;
      return config('set', 'foo=10');
    })
    .then(function(v) {
      t.pass('value set', v);
      return config('get', 'foo');
    })
    .then(function(value) {
      t.equal(value, '10', 'got value from config');
      return config('unset', 'foo');
    })
    .then(function() {
      return config();
    })
    .then(function(all) {
      t.equal(before, all, 'final config matches');
      config('unset', 'bar');
    })
    .catch(function(e) {
      t.fail(e);
    });
});
