import * as policy from 'snyk-policy';
import { test } from 'tap';
import { loadJson } from './utils';

test('test sensibly bails if gets an old .snyk format', async (t) => {
  try {
    const vulns2 = loadJson(
      __dirname + '/fixtures/test-jsbin-vulns-updated.json',
    );
    const config = await policy.load(__dirname + '/fixtures/old-snyk-config');
    const res = await config.filter(vulns2);
    t.fail('was expecting an error, got ' + JSON.stringify(res));
  } catch (e) {
    t.equal(e.code, 'OLD_DOTFILE_FORMAT');
  }
});
