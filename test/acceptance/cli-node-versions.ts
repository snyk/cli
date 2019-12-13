import { test } from 'tap';
import * as sinon from 'sinon';

import { main } from '../../src/cli/main';

test('test unsupported version', async (t) => {
  const sandbox = sinon.createSandbox();
  t.tearDown(() => sandbox.restore());
  sandbox.stub(process.versions, 'node').value('v4.1.2');
  let stderr = '';
  sandbox.stub(process.stderr, 'write').callsFake((msg) => {
    stderr += msg;
    return true;
  });
  try {
    await main();
  } catch {}
  sandbox.restore();
  t.match(stderr, 'unsupported Node.js');
});

test('test legacy version', async (t) => {
  const sandbox = sinon.createSandbox();
  t.tearDown(() => sandbox.restore());
  sandbox.stub(process.versions, 'node').value('v6.17.1');
  let stdout = '';
  sandbox.stub(process.stdout, 'write').callsFake((msg) => {
    stdout += msg;
    return true;
  });
  let stderr = '';
  sandbox.stub(process.stderr, 'write').callsFake((msg) => {
    stderr += msg;
    return true;
  });
  try {
    await main();
  } catch {}
  sandbox.restore();
  t.notMatch(stderr, 'unsupported Node.js');
  t.match(stdout, 'Node.js v6 has reached end-of-life');
});

test('test supported version', async (t) => {
  const sandbox = sinon.createSandbox();
  t.tearDown(() => sandbox.restore());
  sandbox.stub(process.versions, 'node').value('v8.16.2');
  let stdout = '';
  sandbox.stub(process.stdout, 'write').callsFake((msg) => {
    stdout += msg;
    return true;
  });
  let stderr = '';
  sandbox.stub(process.stderr, 'write').callsFake((msg) => {
    stderr += msg;
    return true;
  });
  try {
    await main();
  } catch {}
  sandbox.restore();
  t.notMatch(stderr, 'unsupported Node.js');
  t.notMatch(stdout, 'Node.js v6 has reached end-of-life');
});
