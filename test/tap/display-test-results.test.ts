import * as tap from 'tap';
import * as sinon from 'sinon';
import * as fs from 'fs';

import config from '../../src/lib/config';
import * as cli from '../../src/cli/commands';
import * as snyk from '../../src/lib';
import { chdirWorkspaces } from '../acceptance/workspace-helper';
import { getFixturePath } from '../jest/util/getFixturePath';
import { getWorkspacePath } from '../jest/util/getWorkspacePath';

const { test } = tap;
(tap as any).runOnly = false; // <- for debug. set to true, and replace a test to only(..)

test('`test ruby-app` remediation displayed', async (t) => {
  chdirWorkspaces();
  const stubbedResponse = JSON.parse(
    fs.readFileSync(
      getWorkspacePath('ruby-app/test-graph-response-with-remediation.json'),
      'utf8',
    ),
  );
  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await cli.test('ruby-app');
  } catch (error) {
    const res = error.message;
    t.match(
      res,
      'Upgrade rails@5.2.3 to rails@5.2.3 to fix',
      'upgrade advice displayed',
    );
    t.match(res, 'Tested 52 dependencies for known issues');
    t.match(
      res,
      'This issue was fixed in versions: 1.2.3',
      'fixed in is shown',
    );
    t.match(
      res,
      'No upgrade or patch available',
      'some have no upgrade or patch',
    );
  }

  snykTestStub.restore();
  t.end();
});

test('`test ruby-app` legal instructions displayed', async (t) => {
  chdirWorkspaces();
  const stubbedResponse = JSON.parse(
    fs.readFileSync(
      getWorkspacePath(
        'ruby-app/test-graph-response-with-legal-instruction.json',
      ),
      'utf8',
    ),
  );
  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await cli.test('ruby-app');
  } catch (error) {
    const res = error.message;
    t.match(res, 'I am legal license instruction');
  }

  snykTestStub.restore();
  t.end();
});

test('`test pip-app-license-issue` legal instructions displayed (legacy formatter)', async (t) => {
  chdirWorkspaces();
  const stubbedResponse = JSON.parse(
    fs.readFileSync(
      getWorkspacePath(
        'pip-app-license-issue/test-pip-stub-with-legal-instructions.json',
      ),
      'utf8',
    ),
  );
  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await cli.test('pip-app-license-issue');
  } catch (error) {
    const res = error.message;
    t.match(res, 'I am legal license instruction');
  }

  snykTestStub.restore();
  t.end();
});

test('`test npm-package-with-severity-override` show original severity upgrade', async (t) => {
  chdirWorkspaces();
  const stubbedResponse = JSON.parse(
    fs.readFileSync(
      getFixturePath(
        'npm-package-with-severity-override/test-graph-result-upgrade.json',
      ),
      'utf8',
    ),
  );

  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await cli.test('npm-package-with-severity-override');
  } catch (error) {
    const { message } = error;
    t.match(
      message,
      `[Low Severity (originally Medium)][${config.PUBLIC_VULN_DB_URL}/vuln/npm:node-uuid:20160328]`,
    );
  }

  snykTestStub.restore();
  t.end();
});

test('`test npm-package-with-severity-override` show original severity patches', async (t) => {
  chdirWorkspaces();
  const stubbedResponse = JSON.parse(
    fs.readFileSync(
      getFixturePath(
        'npm-package-with-severity-override/test-graph-result-patches.json',
      ),
      'utf8',
    ),
  );

  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await cli.test('npm-package-with-severity-override');
  } catch (error) {
    const { message } = error;
    t.match(message, 'Patch available for node-uuid@1.4.0');
    t.match(
      message,
      `[Low Severity (originally Medium)][${config.PUBLIC_VULN_DB_URL}/vuln/npm:node-uuid:20160328]`,
    );
  }

  snykTestStub.restore();
  t.end();
});

test('`test npm-package-with-severity-override` show original severity no remediation', async (t) => {
  chdirWorkspaces();
  const stubbedResponse = JSON.parse(
    fs.readFileSync(
      getFixturePath(
        'npm-package-with-severity-override/test-graph-result-no-remediation.json',
      ),
      'utf8',
    ),
  );

  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await cli.test('npm-package-with-severity-override');
  } catch (error) {
    const { message } = error;
    t.match(
      message,
      `Low severity (originally Medium) vulnerability found in node-uuid`,
    );
  }

  snykTestStub.restore();
  t.end();
});

test('`test npm-package-with-severity-override` show original severity unresolved', async (t) => {
  chdirWorkspaces();
  const stubbedResponse = JSON.parse(
    fs.readFileSync(
      getFixturePath(
        'npm-package-with-severity-override/test-graph-result-unresolved.json',
      ),
      'utf8',
    ),
  );

  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await cli.test('npm-package-with-severity-override');
  } catch (error) {
    const { message } = error;
    t.match(
      message,
      `Malicious Package [Low Severity (originally Medium)][${config.PUBLIC_VULN_DB_URL}/vuln/npm:node-uuid:20160328`,
    );
  }

  snykTestStub.restore();
  t.end();
});

test('`test npm-package-with-severity-override` dont show original severity if its the same as original severity', async (t) => {
  chdirWorkspaces();
  const stubbedResponse = JSON.parse(
    fs.readFileSync(
      getFixturePath(
        'npm-package-with-severity-override/test-graph-result-same-severity.json',
      ),
      'utf8',
    ),
  );

  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await cli.test('npm-package-with-severity-override');
  } catch (error) {
    const { message } = error;
    t.match(
      message,
      `[Low Severity][${config.PUBLIC_VULN_DB_URL}/vuln/npm:node-uuid:20160328]`,
    );
  }

  snykTestStub.restore();
  t.end();
});
