import { test } from 'tap';
import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';

import { isDocker } from '../src/lib/is-docker';

test('inside a Docker container (.dockerenv test)', async (t) => {
  delete require.cache[path.join(__dirname, 'index.js')];
  const statSyncStub = sinon.stub(fs, 'statSync').returns({} as any);
  t.true(isDocker());
  statSyncStub.restore();
});

test('inside a Docker container (cgroup test)', async (t) => {
  delete require.cache[path.join(__dirname, 'index.js')];

  const statSyncStub = sinon.stub(fs, 'statSync');
  statSyncStub
    .withArgs('/.dockerenv')
    .throws("ENOENT, no such file or directory '/.dockerinit'");
  const readFileSyncStub = sinon.stub(fs, 'readFileSync');
  readFileSyncStub
    .withArgs('/proc/self/cgroup', 'utf8')
    .returns('xxx docker yyyy');

  t.true(isDocker());

  statSyncStub.restore();
  readFileSyncStub.restore();
});

test('not inside a Docker container', async (t) => {
  delete require.cache[path.join(__dirname, 'index.js')];

  const statSyncStub = sinon.stub(fs, 'statSync');
  statSyncStub
    .withArgs('/.dockerenv')
    .throws("ENOENT, no such file or directory '/.dockerinit'");
  const readFileSyncStub = sinon.stub(fs, 'readFileSync');
  readFileSyncStub.throws('ENOENT, no such file or directory');

  t.false(isDocker());
  statSyncStub.restore();
});
