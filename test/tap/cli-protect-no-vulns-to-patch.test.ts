import { test } from 'tap';
import * as cli from '../../src/cli/commands';
import * as sinon from 'sinon';
import * as snyk from '../../src/lib';
import { getFixturePath } from '../jest/util/getFixturePath';

test('`protect` with no vulns to patch', async (t) => {
  t.plan(1);
  const vulns = require(getFixturePath('npm-package/test-graph-result.json'));
  vulns.vulnerabilities = undefined;
  const testStub = sinon.stub(snyk, 'test').returns(vulns);

  try {
    const result = await cli.protect();
    t.match(result, 'Code is already patched, nothing to do');
  } catch (err) {
    t.fail('should not fail');
  } finally {
    testStub.restore();
  }

  t.end();
});
