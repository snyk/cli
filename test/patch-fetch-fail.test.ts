import { test } from 'tap';
import * as proxyquire from 'proxyquire';

let analytics;

const proxyFetchPatch = proxyquire('../src/lib/protect/fetch-patch', {
  '../request': {
    makeRequest: () => {
      return Promise.resolve({
        res: {
          statusCode: 200,
        },
        body: 'patch content',
      });
    },
  },
  fs: {
    writeFileSync() {
      return;
    },
  },
  '../analytics': {
    add(type, data) {
      analytics = { type, data };
    },
  },
});

const proxyFetchPatchNotFound = proxyquire('../src/lib/protect/fetch-patch', {
  '../request': {
    makeRequest: () => {
      return Promise.resolve({
        res: {
          statusCode: 404,
        },
        body: 'not found',
      });
    },
  },
  '../analytics': {
    add(type, data) {
      analytics = { type, data };
    },
  },
});

const proxyFetchPatchErrorWriting = proxyquire(
  '../src/lib/protect/fetch-patch',
  {
    '../request': {
      makeRequest: () => {
        return Promise.resolve({
          res: {
            statusCode: 200,
          },
          body: 'patch content',
        });
      },
    },
    fs: {
      writeFileSync() {
        throw new Error('Error writing file');
      },
    },
    '../analytics': {
      add(type, data) {
        analytics = { type, data };
      },
    },
  },
);

test('fetch patch returns filename when successful', (t) => {
  return proxyFetchPatch('https://test.patch.url', 'file.patch')
    .then((name) => t.is(name, 'file.patch', 'filename returned'))
    .catch((e) => t.fail('should not throw error', e));
});

test('fetch patch handles error responses', (t) => {
  return proxyFetchPatchNotFound('https://test.patch.url', 'file.patch')
    .then(() => t.fail('should have failed'))
    .catch(() => {
      t.is(
        analytics.type,
        'patch-fetch-fail',
        'analytics type is patch-fetch-fail',
      );
      t.is(analytics.data.code, 404, 'analytics status code is 404');
      t.is(
        analytics.data.message,
        'Failed to fetch patch from https://test.patch.url to file.patch',
        'analytics message is expected',
      );
      t.is(
        analytics.data.patchFilename,
        'file.patch',
        'analytics patch filename is expected',
      );
      t.is(
        analytics.data.patchUrl,
        'https://test.patch.url',
        'analytics patch url is expected',
      );
    });
});

test('fetch patch handles errors thrown while writing file', (t) => {
  return proxyFetchPatchErrorWriting('https://test.patch.url', 'file.patch')
    .then(() => t.fail('should have failed'))
    .catch(() => {
      t.is(
        analytics.type,
        'patch-fetch-fail',
        'analytics type is patch-fetch-fail',
      );
      t.is(
        analytics.data.code,
        undefined,
        'analytics status code is undefined',
      );
      t.is(
        analytics.data.message,
        'Error writing file',
        'analytics message indicates error writing file',
      );
      t.is(
        analytics.data.patchFilename,
        'file.patch',
        'analytics patch filename is expected',
      );
      t.is(
        analytics.data.patchUrl,
        'https://test.patch.url',
        'analytics patch url is expected',
      );
    });
});
