import { test } from 'tap';
const key = (process.env.SNYK_TOKEN = '123456');
import * as snyk from '../src/lib';

test('api token from env', (t) => {
  t.equal(key, snyk.api, 'current api value env value');
  t.end();
});
