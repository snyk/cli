var tap = require('tap');
var test = require('tap').test;
var path = require('path');
var sinon = require('sinon');
var proxyquire = require('proxyquire');
var policySpy = sinon.spy();
var writeSpy = sinon.spy();

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
  },
});

var save = p => {
  policySpy(p);
  return Promise.resolve();
};

var policy = proxyquire('snyk-policy', { save: save });
var mockPolicy;
var noop = () => {};

tap.beforeEach(done => {
  // reset the mock package
  mockPackage = {
    name: 'snyk-test',
    dependencies: {
      foo: '1.1.1'
    },
    devDependencies: {
      bar: '2.2.2'
    },
  };

  writeSpy = sinon.spy();
  policySpy = sinon.spy();
  policy.create().then(p => {
    mockPolicy = p;
    mockPolicy.save = save.bind(null, mockPolicy);
  }).then(done);
});

test('user deps are left alone if they do not test or protect', t => {
  return wizard.processAnswers({
    'misc-test-no-monitor': true,
  }, mockPolicy).then(res => {
    t.equal(writeSpy.called, false, 'the package is not touched');
  });
});

test('snyk adds to devDeps when test only is selected', async (t) => {
  const res = await wizard.processAnswers({
    'misc-add-test': true,
    'misc-test-no-monitor': true,
  }, mockPolicy);

  var pkg = writeSpy.args[0][0];
  console.log('PACKAGE', pkg)

  t.equal(writeSpy.called, true, 'the package was updated');
  t.equal(pkg.scripts.test.includes('snyk test'), true, 'snyk test found in npm test');
  t.equal(pkg.dependencies.snyk, undefined, 'snyk not in production deps');
  t.notEqual(pkg.devDependencies.snyk, undefined, 'snyk IS in dev deps');
});

test('snyk adds to prod deps when protect only is selected', t => {
  return wizard.processAnswers({
    'misc-add-protect': true,
    'misc-test-no-monitor': true,
  }, mockPolicy).then(res => {
    var pkg = writeSpy.args[0][0];

    t.equal(writeSpy.called, true, 'the package was updated');
    t.equal(pkg.scripts.test, undefined, 'snyk test not added');
    t.equal(pkg.scripts['snyk-protect'].includes('snyk protect'), true, 'snyk protect added');
    t.notEqual(pkg.dependencies.snyk, undefined, 'snyk is in production deps');
    t.equal(pkg.devDependencies.snyk, undefined, 'snyk is not in dev deps');
  });
});

test('snyk adds to prod deps when both protect AND test are selected', t => {
  return wizard.processAnswers({
    'misc-add-protect': true,
    'misc-add-test': true,
    'misc-test-no-monitor': true
  }, mockPolicy).then(res => {
    var pkg = writeSpy.args[0][0];

    t.equal(writeSpy.called, true, 'the package was updated');
    t.equal(pkg.scripts.test.includes('snyk test'), true, 'snyk test is added');
    t.equal(pkg.scripts['snyk-protect'].includes('snyk protect'), true, 'snyk protect added');
    t.notEqual(pkg.dependencies.snyk, undefined, 'snyk is in production deps');
    t.equal(pkg.devDependencies.snyk, undefined, 'snyk is not in dev deps');
  });
});

test('upgrades snyk from devDeps to prod deps if protect is used', t => {
  mockPackage = {
    name: 'snyk-test',
    devDependencies: {
      snyk: '*'
    },
  };

  return wizard.processAnswers({
    'misc-add-protect': true,
    'misc-test-no-monitor': true
  }, mockPolicy).then(res => {
    var pkg = writeSpy.args[0][0];

    t.equal(writeSpy.called, true, 'the package was updated');
    t.equal(pkg.scripts['snyk-protect'].includes('snyk protect'), true, 'snyk protect added');
    t.notEqual(pkg.dependencies.snyk, undefined, 'snyk is in production deps');
    t.equal(pkg.devDependencies.snyk, undefined, 'snyk is not in dev deps');
  });
});
