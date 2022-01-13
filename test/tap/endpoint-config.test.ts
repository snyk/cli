import { test, tearDown } from 'tap';
import * as Proxyquire from 'proxyquire';
const proxyquire = Proxyquire.noPreserveCache();
import { InvalidEndpointConfigError } from '../../src/lib/errors/invalid-endpoint-config-error';

const DEFAULT_API = 'https://snyk.io/api/v1';
const originalSnykApiEndpoint = process.env.SNYK_API;
delete process.env.SNYK_API;

tearDown(() => {
  process.env.SNYK_API = originalSnykApiEndpoint;
});

test('uses default endpoint when none is provided by user', (t) => {
  const { default: config } = proxyquire('../../src/lib/config', {
    './user-config': {
      config: {
        get: () => {
          // No user options provided
          return;
        },
      },
    },
  });
  t.equal(config.API, DEFAULT_API);
  t.end();
});

test('uses default endpoint when user endpoint is the same', (t) => {
  const { default: config } = proxyquire('../../src/lib/config', {
    './user-config': {
      config: {
        get: (key) => {
          if (key === 'endpoint') {
            return DEFAULT_API;
          }
          return;
        },
      },
    },
  });
  t.equal(config.API, DEFAULT_API);
  t.end();
});

test('uses a valid custom endpoint when provided', (t) => {
  const providedEndpoint = 'https://myendpoint.local/api';
  const { default: config } = proxyquire('../../src/lib/config', {
    './user-config': {
      config: {
        get: (key) => {
          if (key === 'endpoint') {
            return providedEndpoint;
          }
          return;
        },
      },
    },
  });
  t.equal(config.API, providedEndpoint);
  t.end();
});

test('uses a valid custom endpoint when provided by SNYK_API environment', (t) => {
  const providedEndpoint = 'https://myendpoint.local/api';
  process.env.SNYK_API = providedEndpoint;
  const { default: config } = proxyquire('../../src/lib/config', {
    './user-config': {
      config: {
        get: () => {
          // No user options provided
          return;
        },
      },
    },
  });
  t.equal(config.API, providedEndpoint);
  delete process.env.SNYK_API;
  t.end();
});

test('uses a valid custom localhost endpoint when provided', (t) => {
  const providedEndpoint = 'http://localhost:8000';
  const { default: config } = proxyquire('../../src/lib/config', {
    './user-config': {
      config: {
        get: (key) => {
          if (key === 'endpoint') {
            return providedEndpoint;
          }
          return;
        },
      },
    },
  });
  t.equal(config.API, providedEndpoint);
  t.end();
});

test('throws an error when endpoint option is not a valid URL', (t) => {
  const providedEndpoint = 'myendpoint.local/api';
  t.throws(
    () =>
      proxyquire('../../src/lib/config', {
        './user-config': {
          config: {
            get: (key) => {
              if (key === 'endpoint') {
                return providedEndpoint;
              }
              return;
            },
          },
        },
      }),
    InvalidEndpointConfigError,
  );
  t.end();
});
