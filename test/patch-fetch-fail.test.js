var test = require('tap').test;
var proxyquire = require('proxyquire');
var shouldWork = true;
var timeout = false;
var switchAfterFailure = true;
var analyticsEvent;

var getPatchFile = proxyquire('../src/lib/protect/fetch-patch', {
  'then-fs': {
    createWriteStream: function () {},
  },
  needle: {
    get: function () {
      return {
        on: function (_, responseCb) {
          if (!timeout) {
            responseCb({ statusCode: 200 });
          } else {
            timeout = false;
            responseCb({ statusCode: 504 });
          }
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
                  };
                },
              };
            },
          };
        },
      };
    },
  },
  '../analytics': {
    add: function (type, data) {
      analyticsEvent = {
        type: type,
        data: data,
      };
    },
  },
});

test('Fetch does what it should when request works properly', t => {
  t.plan(1);
  getPatchFile('', 'name')
    .then(name => t.is(name, 'name'))
    .catch(() => t.fail('Rejected'));
});

test('Fetch retries on error', t => {
  t.plan(1);
  shouldWork = false;
  timeout = false;
  getPatchFile('', 'name', 1)
    .then(name => t.is(name, 'name'))
    .catch(() => t.fail('Rejected'));
});

test('Fetch retries on server errors', t => {
  t.plan(1);
  shouldWork = true;
  timeout = true;
  getPatchFile('', 'name', 1)
    .then(name => t.is(name, 'name'))
    .catch(() => t.fail('Rejected'));
});

test('Fetch fails after all attempts are used', t => {
  t.plan(3);
  timeout = false;
  shouldWork = false;
  switchAfterFailure = false;
  getPatchFile('', 'name', 1)
    .then(() => t.fail('Should have failed'))
    .catch(() => {
      t.is(analyticsEvent.type, 'patch-fetch-fail');
      t.is(analyticsEvent.data.message, 'foo');
      t.is(analyticsEvent.data.code, 'bar');
    });
});
