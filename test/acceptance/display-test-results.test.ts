import * as tap from 'tap';
import * as sinon from 'sinon';
import * as _ from 'lodash';
import * as fs from 'fs';

// tslint:disable-next-line:no-var-requires
const snykTest = require('../../src/cli/commands/test');
import * as snyk from '../../src/lib';
import { chdirWorkspaces } from './workspace-helper';

const { test } = tap;
(tap as any).runOnly = false; // <- for debug. set to true, and replace a test to only(..)

test('`test ruby-app` remediation displayed', async (t) => {
  chdirWorkspaces();
  const stubbedResponse = JSON.parse(
    fs.readFileSync(
      __dirname +
        '/workspaces/ruby-app/test-graph-response-with-remediation.json',
      'utf8',
    ),
  );
  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await snykTest('ruby-app');
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
      __dirname +
        '/workspaces/ruby-app/test-graph-response-with-legal-instruction.json',
      'utf8',
    ),
  );
  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await snykTest('ruby-app');
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
      __dirname +
        '/workspaces/pip-app-license-issue/test-pip-stub-with-legal-instructions.json',
      'utf8',
    ),
  );
  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await snykTest('pip-app-license-issue');
  } catch (error) {
    const res = error.message;
    t.match(res, 'I am legal license instruction');
  }

  snykTestStub.restore();
  t.end();
});

test('test reachability info is displayed', async (t) => {
  chdirWorkspaces();
  const stubbedResponse = JSON.parse(
    fs.readFileSync(
      __dirname +
        '/workspaces/reachable-vulns/maven/test-dep-graph-response.json',
      'utf8',
    ),
  );
  const snykTestStub = sinon.stub(snyk, 'test').returns(stubbedResponse);
  try {
    await snykTest('maven-app');
  } catch (error) {
    const { message } = error;
    t.match(message, '[Likely reachable]');
  }

  snykTestStub.restore();
  t.end();
});
