const tap = require('tap');
const test = require('tap').test;
const sinon = require('sinon').createSandbox();
const proxyquire = require('proxyquire');
let policySpy = sinon.spy();
let writeSpy = sinon.spy();
const detect = require('../src/lib/detect');

sinon.stub(detect, 'detectPackageManager')
  .returns('npm');
sinon.stub(detect, 'detectPackageFile')
  .returns('package.json');

tap.tearDown(() => {
  sinon.restore();
});

var mockPackage;

var wizard = proxyquire('../src/cli/commands/protect/wizard', {
  'then-fs': {
    writeFile: function (filename, content) {
      if (filename.includes('package.json')) {
        writeSpy(JSON.parse(content));
      }
      return Promise.resolve();
    },
    readFile: function (filename) {
      return Promise.resolve(JSON.stringify(mockPackage));
    },
    '../../../lib/npm': {
      getVersion: function() {
        return new Promise(function(resolve) {
          return resolve('5.0.1');
        });
      },
    },
    '../../../lib/protect': {
      install: () => new Promise((resolve) => resolve()),
      installDev: () => new Promise((resolve) => resolve()),
    },
  },
});

var save = p => {
  policySpy(p);
  return Promise.resolve();
};

var policy = proxyquire('snyk-policy', { save: save });
var mockPolicy;

tap.beforeEach(done => {
  // reset the mock package
  mockPackage = {
    name: 'snyk-test',
    dependencies: {
      foo: '1.1.1',
    },
    devDependencies: {
      bar: '2.2.2',
    },
  };

  writeSpy = sinon.spy();
  policySpy = sinon.spy();
  policy.create().then(p => {
    mockPolicy = p;
    mockPolicy.save = save.bind(null, mockPolicy);
  }).then(done);
});

test('user deps are left alone if they do not test or protect', async (t) => {
  process.chdir(__dirname, '/fixtures/protect');

  await wizard.processAnswers({
    'misc-test-no-monitor': true,
  }, mockPolicy);

  t.equal(writeSpy.called, false, 'the package is not touched');
});

test('snyk adds to devDeps when test only is selected', async (t)  => {
  process.chdir(__dirname, '/fixtures/protect');
  await wizard.processAnswers({
    'misc-add-test': true,
    'misc-test-no-monitor': true,
  }, mockPolicy);

  var pkg = writeSpy.args[0][0];
  t.equal(writeSpy.called, true, 'the package was updated');
  t.equal(pkg.scripts.test.includes('snyk test'), true, 'snyk test found in npm test');
  t.equal(pkg.dependencies.snyk, undefined, 'snyk not in production deps');
  t.notEqual(pkg.devDependencies.snyk, undefined, 'snyk IS in dev deps');
  process.chdir(__dirname);
});

test('snyk adds to prod deps when protect only is selected', async (t) => {
  process.chdir(__dirname, '/fixtures/protect');
  await wizard.processAnswers({
    'misc-add-protect': true,
    'misc-test-no-monitor': true,
  }, mockPolicy);

  var pkg = writeSpy.args[0][0];

  t.equal(writeSpy.called, true, 'the package was updated');
  t.equal(pkg.scripts.test, undefined, 'snyk test not added');
  t.equal(pkg.scripts['snyk-protect'].includes('snyk protect'), true, 'snyk protect added');
  t.notEqual(pkg.dependencies.snyk, undefined, 'snyk is in production deps');
  t.equal(pkg.devDependencies.snyk, undefined, 'snyk is not in dev deps');
  process.chdir(__dirname);
});

test('snyk adds to prod deps when both protect AND test are selected',async (t) => {
  process.chdir(__dirname, '/fixtures/debug-package');
  await wizard.processAnswers({
    'misc-add-protect': true,
    'misc-add-test': true,
    'misc-test-no-monitor': true,
  }, mockPolicy);
  var pkg = writeSpy.args[0][0];

  t.equal(writeSpy.called, true, 'the package was updated');
  t.equal(pkg.scripts.test.includes('snyk test'), true, 'snyk test is added');
  t.equal(pkg.scripts['snyk-protect'].includes('snyk protect'), true, 'snyk protect added');
  t.notEqual(pkg.dependencies.snyk, undefined, 'snyk is in production deps');
  t.equal(pkg.devDependencies.snyk, undefined, 'snyk is not in dev deps');
  process.chdir(__dirname);
});

test('upgrades snyk from devDeps to prod deps if protect is used', async (t) => {
  process.chdir(__dirname, '/fixtures/debug-package');

  mockPackage = {
    name: 'snyk-test',
    devDependencies: {
      snyk: '*',
    },
  };

  return wizard.processAnswers({
    'misc-add-protect': true,
    'misc-test-no-monitor': true,
  }, mockPolicy);

  var pkg = writeSpy.args[0][0];

  t.equal(writeSpy.called, true, 'the package was updated');
  t.equal(pkg.scripts['snyk-protect'].includes('snyk protect'), true, 'snyk protect added');
  t.notEqual(pkg.dependencies.snyk, undefined, 'snyk is in production deps');
  t.equal(pkg.devDependencies.snyk, undefined, 'snyk is not in dev deps');
  process.chdir(__dirname);
});
