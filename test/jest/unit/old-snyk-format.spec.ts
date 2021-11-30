import policy from 'snyk-policy';
import { loadJson } from '../../utils';
import path from 'path';

it('test sensibly bails if gets an old .snyk format', async () => {
  const vulns2 = loadJson(
    path.resolve(__dirname, '../../fixtures/test-jsbin-vulns-updated.json'),
  );
  try {
    const config = await policy.load(
      path.resolve(__dirname, '../../fixtures/old-snyk-config'),
    );
    const res = await config.filter(vulns2);
    throw new Error('was expecting an error, got ' + JSON.stringify(res));
  } catch (e) {
    expect(e.code).toEqual('OLD_DOTFILE_FORMAT');
  }
});
