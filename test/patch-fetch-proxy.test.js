var test = require('tap').test;
var proxyquire = require('proxyquire');
var sinon = require('sinon');
var spy = sinon.spy();
var shouldWork = true;
var timeout = false;
var switchAfterFailure = true;
var analyticsEvent;

var PROXY_HOST = 'my.proxy.com';
var PROXY_PORT = 4242;
var PATCH_URL = 'https://s3.amazonaws.com/snyk-rules-pre-repository/' +
                'snapshots/master/patches/npm/qs/20170213/603_604.patch';

var getPatchFile = proxyquire('../src/lib/protect/fetch-patch', {
  'then-fs': {
    createWriteStream: function () {},
  },
  needle: {
    get: function () {
      spy(arguments[0], arguments[1]);
      return {
        on: function (_, responseCb) {
          responseCb({ statusCode: 200 });
          return {
            on: function (_, cb) {
              cb();
              return {
                on: function (_, cb) {
                  cb({ message: 'foo', code: 'bar' });
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

test('Fetch gets patches with no proxy', function (t) {
  t.plan(1);
  return getPatchFile(PATCH_URL, 'unused')
    .then(() => {
      t.is(spy.getCall(0).args[1].agent, undefined, 'no proxy agent found');
    })
    .catch(err => t.fail(err.message));
});

/**
 * Verify support for http(s) proxy from environments variables
 * (https_proxy, HTTPS_PROXY, no_proxy)
 * see https://www.gnu.org/software/wget/manual/html_node/Proxies.html
 */
test('proxy environment variables', function (t) {
  t.plan(3);

  t.test('https_proxy', function (t) {
    var proxyUri = 'http://' + PROXY_HOST + ':' + PROXY_PORT;
    process.env.https_proxy = proxyUri;
    return getPatchFile(PATCH_URL, 'unused')
    .then(() => {
      t.is(spy.getCall(1).args[1].agent.proxyUri, proxyUri, 'proxy url found');
    })
    .catch(err => t.fail(err.message))
    .then(() => delete process.env.https_proxy);
  });

  t.test('HTTPS_PROXY', function (t) {
    var proxyUri = 'http://' + PROXY_HOST + ':' + PROXY_PORT;
    process.env.HTTPS_PROXY = proxyUri;
    return getPatchFile(PATCH_URL, 'unused')
    .then(() => {
      t.is(spy.getCall(2).args[1].agent.proxyUri, proxyUri, 'proxy url found');
    })
    .catch(err => t.fail(err.message))
    .then(() => delete process.env.HTTPS_PROXY);
  });

  t.test('no_proxy', function (t) {
    process.env.https_proxy = 'http://' + PROXY_HOST + ':' + PROXY_PORT;
    process.env.no_proxy = '*';
    return getPatchFile(PATCH_URL, 'unused')
      .then(() => {
        t.is(spy.getCall(3).args[1].agent, undefined, 'no proxy agent found');
      })
      .catch(err => t.fail(err.message))
      .then(() => {
        delete process.env.https_proxy;
        delete process.env.no_proxy;
      });
    });
});
