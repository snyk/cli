import { test } from 'tap';
import * as Proxyquire from 'proxyquire';
const proxyquire = Proxyquire.noPreserveCache();

test('getInfo returns null for isFromContainer=true', async (t) => {
  const {
    getInfo,
  } = require('../../src/lib/project-metadata/target-builders/git');
  const gitInfo = await getInfo(true);
  t.same(gitInfo, null);
});

test('getInfo handles provided https remote url as http', async (t) => {
  const providedUrl = 'https://myserver.local/myproject.git';
  const { getInfo } = proxyquire(
    '../../src/lib/project-metadata/target-builders/git',
    {
      '../../sub-process': {
        execute() {
          return providedUrl;
        },
      },
    },
  );
  const gitInfo = await getInfo(false);
  t.same(gitInfo.remoteUrl, 'http://myserver.local/myproject.git');
});

test('getInfo handles provided http remote url', async (t) => {
  const providedUrl = 'http://github.com/snyk/snyk.git';
  const { getInfo } = proxyquire(
    '../../src/lib/project-metadata/target-builders/git',
    {
      '../../sub-process': {
        execute() {
          return providedUrl;
        },
      },
    },
  );
  const gitInfo = await getInfo(false);
  t.same(gitInfo.remoteUrl, providedUrl);
});

test('getInfo handles provided ssh remote url as http', async (t) => {
  const providedUrl = 'ssh://git@myserver.local/myproject.git';
  const { getInfo } = proxyquire(
    '../../src/lib/project-metadata/target-builders/git',
    {
      '../../sub-process': {
        execute() {
          return providedUrl;
        },
      },
    },
  );
  const gitInfo = await getInfo(false);
  t.same(gitInfo.remoteUrl, 'http://myserver.local/myproject.git');
});

test('getInfo handles provided scp-like syntax with user in remote url', async (t) => {
  const providedUrl = 'git@myserver.local:myproject.git';
  const { getInfo } = proxyquire(
    '../../src/lib/project-metadata/target-builders/git',
    {
      '../../sub-process': {
        execute() {
          return providedUrl;
        },
      },
    },
  );
  const gitInfo = await getInfo(false);
  t.same(gitInfo.remoteUrl, 'http://myserver.local/myproject.git');
});

test('getInfo handles provided scp-like syntax without user in remote url', async (t) => {
  const providedUrl = 'myserver.local:folder/myproject.git';
  const { getInfo } = proxyquire(
    '../../src/lib/project-metadata/target-builders/git',
    {
      '../../sub-process': {
        execute() {
          return providedUrl;
        },
      },
    },
  );
  const gitInfo = await getInfo(false);
  t.same(gitInfo.remoteUrl, 'http://myserver.local/folder/myproject.git');
});

test('getInfo handles invalid URL by keeping it as is', async (t) => {
  const providedUrl = 'nonce';
  const { getInfo } = proxyquire(
    '../../src/lib/project-metadata/target-builders/git',
    {
      '../../sub-process': {
        execute() {
          return providedUrl;
        },
      },
    },
  );
  const gitInfo = await getInfo(false);
  t.same(gitInfo.remoteUrl, providedUrl);
});

test('getInfo handles undefined by returning undefined', async (t) => {
  const providedUrl = undefined;
  const { getInfo } = proxyquire(
    '../../src/lib/project-metadata/target-builders/git',
    {
      '../../sub-process': {
        execute() {
          return providedUrl;
        },
      },
    },
  );
  const gitInfo = await getInfo(false);
  t.same(gitInfo.remoteUrl, undefined);
});
