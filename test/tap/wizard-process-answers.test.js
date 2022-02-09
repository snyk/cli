const tap = require('tap');
const test = require('tap').test;
const proxyquire = require('proxyquire');
const path = require('path');
const sinon = require('sinon');
const fs = require('fs');
const noop = function () {};
const snyk = require('../../src/lib');
const { getFixturePath } = require('../jest/util/getFixturePath');

// spies
let policySaveSpy;
let execSpy;
let writeSpy;

// policy
const save = (p) => {
  policySaveSpy(p);
  return Promise.resolve();
};

snyk.policy.save = function (data) {
  policySaveSpy(data);
  return Promise.resolve();
};

const policy = proxyquire('snyk-policy', { save: save });
let mockPolicy;

tap.beforeEach((done) => {
  // reset all spies
  policySaveSpy = sinon.spy();
  execSpy = sinon.spy();
  writeSpy = sinon.spy();

  policy
    .create()
    .then((p) => {
      mockPolicy = p;
      mockPolicy.save = save.bind(null, mockPolicy);
    })
    .then(done);
});

// proxies
const getVulnSource = proxyquire('../../src/lib/protect/get-vuln-source', {
  fs: {
    statSync: function () {
      return true;
    },
  },
});

const mockfs = {
  writeFileSync: function (filename, body) {
    writeSpy(filename, body);
  },
  createWriteStream: function () {
    // fake event emitter (sort of)
    return {
      on: noop,
      end: noop,
      removeListener: noop,
      emit: noop,
    };
  },
};

const wizard = proxyquire('../../src/cli/commands/protect/wizard', {
  '../../../lib/npm': {
    default: function (cmd) {
      execSpy(cmd);
      return Promise.resolve(true);
    },
    getVersion: function () {
      return Promise.resolve('6.0.0');
    },
  },
  fs: mockfs,
  '../../../src/lib/protect': proxyquire('../../src/lib/protect', {
    fs: {
      statSync: function () {
        return true;
      },
    },
    './get-vuln-source': getVulnSource,
    './patch': proxyquire('../../src/lib/protect/patch', {
      './write-patch-flag': proxyquire(
        '../../src/lib/protect/write-patch-flag',
        {
          fs: mockfs,
        },
      ),
      './get-vuln-source': getVulnSource,
      fs: mockfs,
      './apply-patch': function () {
        return Promise.resolve();
      },
    }),
    './update': proxyquire('../../src/lib/protect/update', {
      '../npm': {
        default: function (cmd, packages, live, cwd, flags) {
          execSpy(cmd, packages, live, cwd, flags);
          return Promise.resolve(true);
        },
      },
    }),
  }),
});

test('pre-tarred packages can be patched', function (t) {
  const answers = require(getFixturePath('forever-answers.json'));

  wizard
    .processAnswers(answers, mockPolicy)
    .then(function () {
      t.equal(policySaveSpy.callCount, 1, 'write functon was only called once');
      const vulns = Object.keys(policySaveSpy.args[0][0].patch);
      const expect = Object.keys(answers)
        .filter(function (key) {
          return key.slice(0, 5) !== 'misc-';
        })
        .map(function (key) {
          return answers[key].vuln.id;
        });
      t.deepEqual(vulns, expect, 'two patches included');
    })
    .catch(t.threw)
    .then(t.end);
});

test('process answers handles shrinkwrap', function (t) {
  t.plan(2);

  t.test('non-shrinkwrap package', function (t) {
    execSpy = sinon.spy();
    const answers = require(getFixturePath('forever-answers.json'));
    answers['misc-test-no-monitor'] = true;
    wizard
      .processAnswers(answers, mockPolicy)
      .then(function () {
        t.equal(execSpy.callCount, 0, 'shrinkwrap was not called');
      })
      .catch(t.threw)
      .then(t.end);
  });

  t.test('shrinkwraped package', function (t) {
    execSpy = sinon.spy();
    const cwd = process.cwd();
    process.chdir(getFixturePath('pkg-mean-io/'));
    const answers = require(getFixturePath('mean-answers.json'));
    answers['misc-test-no-monitor'] = true;
    wizard
      .processAnswers(answers, mockPolicy)
      .then(function () {
        const shrinkCall = execSpy.getCall(2); // get the 2nd call (as the first is the install of snyk)
        t.equal(shrinkCall.args[0], 'shrinkwrap', 'shrinkwrap was called');
        process.chdir(cwd);
      })
      .catch(t.threw)
      .then(t.end);
  });
});

test('wizard updates vulns without changing dep type', function (t) {
  execSpy = sinon.spy();
  const cwd = process.cwd();
  process.chdir(getFixturePath('pkg-SC-1472/'));
  const answers = require(getFixturePath('pkg-SC-1472/SC-1472.json'));
  answers['misc-test-no-monitor'] = true;
  wizard
    .processAnswers(answers, mockPolicy)
    .then(function () {
      t.equal(execSpy.callCount, 3, 'uninstall, install prod, install dev');
      t.equal(execSpy.getCall(1).args[1].length, 1, '1 prod dep');
      t.equal(execSpy.getCall(1).args[1].length, 1, '2 dev dep');
      process.chdir(cwd);
    })
    .catch(t.threw)
    .then(t.end);
});

test('wizard replaces npms default scripts.test', function (t) {
  const old = process.cwd();
  const dir = getFixturePath('no-deps');
  writeSpy = sinon.spy(); // create a new spy
  process.chdir(dir);

  wizard
    .processAnswers(
      {
        'misc-add-test': true,
        'misc-test-no-monitor': true,
      },
      mockPolicy,
    )
    .then(function () {
      t.equal(writeSpy.callCount, 1, 'package was written to');
      const pkg = JSON.parse(writeSpy.args[0][1]);
      t.equal(pkg.scripts.test, 'snyk test', 'default npm exit 1 was replaced');
    })
    .catch(t.threw)
    .then(function () {
      process.chdir(old);
      t.end();
    });
});

test('wizard replaces prepends to scripts.test', function (t) {
  const old = process.cwd();
  const dir = getFixturePath('demo-os');
  const prevPkg = require(dir + '/package.json');
  writeSpy = sinon.spy(); // create a new spy
  process.chdir(dir);

  wizard
    .processAnswers(
      {
        'misc-add-test': true,
        'misc-test-no-monitor': true,
      },
      mockPolicy,
    )
    .then(function () {
      t.equal(writeSpy.callCount, 1, 'package was written to');
      const pkg = JSON.parse(writeSpy.args[0][1]);
      t.equal(
        pkg.scripts.test,
        'snyk test && ' + prevPkg.scripts.test,
        'prepended to test script',
      );
    })
    .catch(t.threw)
    .then(function () {
      process.chdir(old);
      t.end();
    });
});

test('wizard detects existing snyk in scripts.test', function (t) {
  const old = process.cwd();
  const dir = getFixturePath('pkg-mean-io');
  const prevPkg = require(dir + '/package.json');
  writeSpy = sinon.spy(); // create a new spy
  process.chdir(dir);

  wizard
    .processAnswers(
      {
        'misc-add-test': true,
        'misc-test-no-monitor': true,
      },
      mockPolicy,
    )
    .then(function () {
      t.equal(writeSpy.callCount, 1, 'package was written to');
      const pkg = JSON.parse(writeSpy.args[0][1]);
      t.equal(pkg.scripts.test, prevPkg.scripts.test, 'test script untouched');
    })
    .catch(t.threw)
    .then(function () {
      process.chdir(old);
      t.end();
    });
});

test('wizard maintains whitespace at beginning and end of package.json', function (t) {
  const old = process.cwd();
  const dir = getFixturePath('pkg-mean-io');
  writeSpy = sinon.spy(); // create a new spy
  process.chdir(dir);

  wizard
    .processAnswers(
      {
        'misc-add-test': true,
        'misc-test-no-monitor': true,
      },
      mockPolicy,
      {
        packageLeading: '\n',
        packageTrailing: '\n\n',
      },
    )
    .then(function () {
      const pkgString = writeSpy.args[0][1];
      t.equal(pkgString.substr(0, 2), '\n{', 'newline at beginning of file');
      t.equal(
        pkgString.substr(pkgString.length - 3),
        '}\n\n',
        'two newlines at end of file',
      );
    })
    .catch(t.threw)
    .then(function () {
      process.chdir(old);
      t.end();
    });
});

test('wizard updates vulns and retains indentation', async function (t) {
  const old = process.cwd();
  const dir = getFixturePath('four-spaces');
  const manifestPath = path.resolve(dir, 'package.json');
  const original = fs.readFileSync(manifestPath, 'utf-8');
  writeSpy = sinon.spy();
  process.chdir(dir);

  await wizard.processAnswers(
    {
      'misc-add-test': true,
      'misc-test-no-monitor': true,
    },
    mockPolicy,
  );
  const pkgString = writeSpy.args[0][1];
  t.equal(pkgString, original, 'package.json retains indentation');

  process.chdir(old);
  t.end();
});

test('wizard updates vulns but does not install snyk', async function (t) {
  const old = process.cwd();
  const dir = getFixturePath('basic-npm');
  const answersPath = path.resolve(dir, 'answers.json');

  const answers = JSON.parse(fs.readFileSync(answersPath, 'utf-8'));

  const installCommands = [
    ['uninstall', ['minimatch'], true, undefined, undefined],
    ['install', ['minimatch@3.0.2'], true, null, ['--save-dev']],
  ];

  process.chdir(dir);

  await wizard.processAnswers(answers, mockPolicy);

  t.deepEqual(execSpy.args, installCommands, 'snyk not installed');

  process.chdir(old);
  t.end();
});
