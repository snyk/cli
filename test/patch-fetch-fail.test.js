var test = require('tap-only');
var proxyquire = require('proxyquire');
var Promise = require('es6-promise').Promise; // jshint ignore:line
var shouldWork = true;
var switchAfterFailure = true;
var analyticsEvent;

var patch = proxyquire('../lib/protect/patch', {
  'then-fs': {
    createWriteStream: function () {},
  },
  request: function () {
    return {
      on: function (_, cb) {
        if (shouldWork) {
          cb();
        }
        return {
          on: function (_, cb) {
            if (!shouldWork) {
              if (switchAfterFailure) {
                shouldWork = !shouldWork;
              }
              cb({
                message: 'foo',
                code: 'bar',
              });
            }
            return {
              pipe: function () {},
            }
          }
        }
      }
    };
  },
  '../analytics': {
    add: function (type, data) {
      analyticsEvent = {
        type: type,
        data: data,
      }
    },
  },
});

test('Fetch does what it should when request works properly', t => {
  t.plan(1);
  patch._getPatchFile('', 'name',
                      () => t.fail('Rejected'),
                      (name) => t.is(name, 'name'));
});

test('Fetch retries on error', t => {
  t.plan(1);
  shouldWork = false;
  patch._getPatchFile('', 'name',
                      () => t.fail('Rejected'),
                      (name) => t.is(name, 'name'),
                      1);
});

test('Fetch fails after all attempts are used', t => {
  t.plan(3);
  shouldWork = false;
  switchAfterFailure = false;
  patch._getPatchFile('', 'name',
                      () => {
                        t.is(analyticsEvent.type, 'patch-fetch-fail');
                        t.is(analyticsEvent.data.message, 'foo');
                        t.is(analyticsEvent.data.code, 'bar');
                      },
                      () => t.fail('Should have failed'),
                      1);
});