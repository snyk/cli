import { test } from 'tap';
import * as cli from '../../src/cli/commands';
import sinon from 'sinon';
import * as snyk from '../../src/lib';

test('`protect` with no vulns to patch', async (t) => {
  t.plan(1);
  const vulns = require('./fixtures/npm-package/test-graph-result.json');
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
