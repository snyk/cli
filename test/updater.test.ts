import { test } from 'tap';
import * as fs from 'fs';
import { updateCheck } from '../src/lib/updater';
import * as path from 'path';
import * as sinon from 'sinon';
import * as updateNotifier from 'update-notifier';

// Fake location of the package.json file and verify the code behaves well
test('missing package.json', (t) => {
  const fsStub = sinon.stub(fs, 'existsSync');
  fsStub.withArgs(path.join(__dirname, '../', 'package.json')).returns(false);

  t.tearDown(() => {
    fsStub.restore();
  });

  t.equal(
    updateCheck(),
    false,
    'Notifier was not started on missing package.json',
  );
  t.end();
});

test('STANDALONE declaration present', (t) => {
  const fsStub = sinon.stub(fs, 'existsSync');
  fsStub.withArgs(path.join(__dirname, '../', 'package.json')).returns(true);
  fsStub.withArgs(path.join(__dirname, '../src', 'STANDALONE')).returns(true);

  t.tearDown(() => {
    fsStub.restore();
  });

  t.equal(updateCheck(), false, 'Notifier was not started for binary build');
  t.end();
});

// Run updateNotifier API for the basic package. The target is to verify API still stands
test('verify updater', async (t) => {
  const pkg = {
    name: 'snyk',
    version: '1.0.0',
  };
  const notifier = updateNotifier({ pkg });
  const info = await notifier.fetchInfo();

  t.equal(info.name, 'snyk', 'Successful call to notifier');
  t.end();
});
