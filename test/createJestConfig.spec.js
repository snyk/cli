const test = require('node:test');
const assert = require('node:assert');

const factoryPath = require.resolve('./createJestConfig');

function loadCreateJestConfig(envValue) {
  if (envValue === undefined) {
    delete process.env.TEST_SNYK_IGNORE_LIST;
  } else {
    process.env.TEST_SNYK_IGNORE_LIST = envValue;
  }
  delete require.cache[factoryPath];
  return require('./createJestConfig').createJestConfig;
}

test('no TEST_SNYK_IGNORE_LIST: no stderr banner, base paths preserved', () => {
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...args) => warns.push(args);
  try {
    const createJestConfig = loadCreateJestConfig(undefined);
    const cfg = createJestConfig({});
    assert.ok(cfg.testPathIgnorePatterns.includes('/node_modules/'));
    assert.strictEqual(warns.length, 0);
  } finally {
    console.warn = origWarn;
    delete process.env.TEST_SNYK_IGNORE_LIST;
    delete require.cache[factoryPath];
  }
});

test('empty TEST_SNYK_IGNORE_LIST after trim: no banner', () => {
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...args) => warns.push(args);
  try {
    const createJestConfig = loadCreateJestConfig('   ');
    createJestConfig({});
    assert.strictEqual(warns.length, 0);
  } finally {
    console.warn = origWarn;
    delete process.env.TEST_SNYK_IGNORE_LIST;
    delete require.cache[factoryPath];
  }
});

test('non-empty list: warn includes fragments and merges into testPathIgnorePatterns', () => {
  const warns = [];
  const origWarn = console.warn;
  console.warn = (...args) => warns.push(args);
  try {
    const createJestConfig = loadCreateJestConfig('foo, bar ,,, baz ');
    const cfg = createJestConfig({});
    assert.deepStrictEqual(warns[0][1], ['foo', 'bar', 'baz']);
    assert.ok(cfg.testPathIgnorePatterns.includes('foo'));
    assert.ok(cfg.testPathIgnorePatterns.includes('bar'));
    assert.ok(cfg.testPathIgnorePatterns.includes('baz'));
    assert.ok(cfg.testPathIgnorePatterns.includes('/node_modules/'));
  } finally {
    console.warn = origWarn;
    delete process.env.TEST_SNYK_IGNORE_LIST;
    delete require.cache[factoryPath];
  }
});

test('caller testPathIgnorePatterns merge after env fragments, not overwriting base', () => {
  const origWarn = console.warn;
  console.warn = () => {};
  try {
    const createJestConfig = loadCreateJestConfig('from-env');
    const cfg = createJestConfig({
      testPathIgnorePatterns: ['/caller-only/'],
    });
    const paths = cfg.testPathIgnorePatterns;
    const idxBase = paths.indexOf('/node_modules/');
    const idxEnv = paths.indexOf('from-env');
    const idxCaller = paths.indexOf('/caller-only/');
    assert.ok(idxBase !== -1 && idxEnv !== -1 && idxCaller !== -1);
    assert.ok(idxBase < idxEnv && idxEnv < idxCaller);
  } finally {
    console.warn = origWarn;
    delete process.env.TEST_SNYK_IGNORE_LIST;
    delete require.cache[factoryPath];
  }
});
