import { afterEach, test } from 'tap';
import * as sinon from 'sinon';
import * as proxyquire from 'proxyquire';
import * as needle from 'needle';
import { Global } from '../src/cli/args';
import * as http from 'http';

declare const global: Global;

const needleStub = sinon.stub(needle, 'request');

const request = proxyquire('../src/lib/request', {
  needle: {
    request: needleStub,
  },
});

afterEach((done) => {
  needleStub.resetHistory();
  delete process.env.https_proxy;
  delete process.env.http_proxy;
  delete process.env.no_proxy;
  global.ignoreUnknownCA = false;
  done();
});

test('request calls needle as expected and returns status code and body', (t) => {
  needleStub.yields(null, { statusCode: 200 }, 'text');
  const payload = {
    url: 'http://test.stub',
  };
  return request
    .makeRequest(payload)
    .then((response) => {
      t.deepEquals(
        response,
        { res: { statusCode: 200 }, body: 'text' },
        'response ok',
      );
      t.ok(
        needleStub.calledWith(
          'get', // default
          'https://test.stub/', // turns http to https and appends /
          sinon.match.falsy, // no data
          sinon.match({
            headers: sinon.match({
              'x-snyk-cli-version': sinon.match.string, // dynamic version
              'content-encoding': undefined, // should not set when no data
              'content-length': undefined, // should not be set when no data
            }),
            follow_max: 5, // default
            timeout: 300000, // default
            json: undefined, // default
            agent: sinon.match.instanceOf(http.Agent),
            rejectUnauthorized: undefined, // should not be set when not use insecure mode
          }),
          sinon.match.func, // callback function
        ),
        'needle called as expected',
      );
    })
    .catch((e) => t.fail('should not throw error', e));
});

test('request to localhost calls needle as expected', (t) => {
  needleStub.yields(null, { statusCode: 200 }, 'text');
  const payload = {
    url: 'http://localhost',
  };
  return request
    .makeRequest(payload)
    .then((response) => {
      t.deepEquals(
        response,
        { res: { statusCode: 200 }, body: 'text' },
        'response ok',
      );
      t.ok(
        needleStub.calledWith(
          'get', // default
          'http://localhost', // does not force https
          sinon.match.falsy, // no data
          sinon.match({
            headers: sinon.match({
              'x-snyk-cli-version': sinon.match.string, // dynamic version
              'content-encoding': undefined, // should not set when no data
              'content-length': undefined, // should not be set when no data
            }),
            follow_max: 5, // default
            timeout: 300000, // default
            json: undefined, // default
            agent: sinon.match.instanceOf(http.Agent),
            rejectUnauthorized: undefined, // should not be set when not use insecure mode
          }),
          sinon.match.func, // callback function
        ),
        'needle called as expected',
      );
    })
    .catch((e) => t.fail('should not throw error', e));
});

test('request with timeout calls needle as expected', (t) => {
  needleStub.yields(null, { statusCode: 200 }, 'text');
  const payload = {
    url: 'http://test.stub',
    timeout: 100000,
  };
  return request
    .makeRequest(payload)
    .then((response) => {
      t.deepEquals(
        response,
        { res: { statusCode: 200 }, body: 'text' },
        'response ok',
      );
      t.ok(
        needleStub.calledWith(
          'get', // default
          'https://test.stub/', // turns http to https and appends /
          sinon.match.falsy, // no data
          sinon.match({
            headers: sinon.match({
              'x-snyk-cli-version': sinon.match.string, // dynamic version
              'content-encoding': undefined, // should not set when no data
              'content-length': undefined, // should not be set when no data
            }),
            follow_max: 5, // default
            timeout: 100000, // provided
            json: undefined, // default
            agent: sinon.match.instanceOf(http.Agent),
            rejectUnauthorized: undefined, // should not be set when not use insecure mode
          }),
          sinon.match.func, // callback function
        ),
        'needle called as expected',
      );
    })
    .catch((e) => t.fail('should not throw error', e));
});

test('request with query string calls needle as expected', (t) => {
  needleStub.yields(null, { statusCode: 200 }, 'text');
  const payload = {
    url: 'https://test.stub',
    qs: {
      key: 'value',
      test: ['multi', 'value'],
    },
  };
  return request
    .makeRequest(payload)
    .then((response) => {
      t.deepEquals(
        response,
        { res: { statusCode: 200 }, body: 'text' },
        'response ok',
      );
      t.ok(
        needleStub.calledWith(
          'get', // default
          'https://test.stub/?key=value&test=multi&test=value', // appends querystring
          sinon.match.falsy, // no data
          sinon.match({
            headers: sinon.match({
              'x-snyk-cli-version': sinon.match.string, // dynamic version
              'content-encoding': undefined, // should not set when no data
              'content-length': undefined, // should not be set when no data
            }),
            follow_max: 5, // default
            timeout: 300000, // default
            json: undefined, // default
            agent: sinon.match.instanceOf(http.Agent),
            rejectUnauthorized: undefined, // should not be set when not use insecure mode
          }),
          sinon.match.func, // callback function
        ),
        'needle called as expected',
      );
    })
    .catch((e) => t.fail('should not throw error', e));
});

test('request with json calls needle as expected', (t) => {
  needleStub.yields(null, { statusCode: 200 }, 'text');
  const payload = {
    url: 'http://test.stub',
    json: false,
  };
  return request
    .makeRequest(payload)
    .then((response) => {
      t.deepEquals(
        response,
        { res: { statusCode: 200 }, body: 'text' },
        'response ok',
      );
      t.ok(
        needleStub.calledWith(
          'get', // default
          'https://test.stub/', // turns http to https and appends /
          sinon.match.falsy, // no data
          sinon.match({
            headers: sinon.match({
              'x-snyk-cli-version': sinon.match.string, // dynamic version
              'content-encoding': undefined, // should not set when no data
              'content-length': undefined, // should not be set when no data
            }),
            follow_max: 5, // default
            timeout: 300000, // default
            json: false, // provided
            agent: sinon.match.instanceOf(http.Agent),
            rejectUnauthorized: undefined, // should not be set when not use insecure mode
          }),
          sinon.match.func, // callback function
        ),
        'needle called as expected',
      );
    })
    .catch((e) => t.fail('should not throw error', e));
});

test('request with custom header calls needle as expected', (t) => {
  needleStub.yields(null, { statusCode: 200 }, 'text');
  const payload = {
    url: 'http://test.stub',
    headers: {
      custom: 'header',
    },
  };
  return request
    .makeRequest(payload)
    .then((response) => {
      t.deepEquals(
        response,
        { res: { statusCode: 200 }, body: 'text' },
        'response ok',
      );
      t.ok(
        needleStub.calledWith(
          'get', // default
          'https://test.stub/', // turns http to https and appends /
          sinon.match.falsy, // no data
          sinon.match({
            headers: sinon.match({
              custom: 'header', // provided
              'x-snyk-cli-version': sinon.match.string, // dynamic version
              'content-encoding': undefined, // should not set when no data
              'content-length': undefined, // should not be set when no data
            }),
            follow_max: 5, // default
            timeout: 300000, // default
            json: undefined, // default
            agent: sinon.match.instanceOf(http.Agent),
            rejectUnauthorized: undefined, // should not be set when not use insecure mode
          }),
          sinon.match.func, // callback function
        ),
        'needle called as expected',
      );
    })
    .catch((e) => t.fail('should not throw error', e));
});

test('request with https proxy calls needle as expected', (t) => {
  needleStub.yields(null, { statusCode: 200 }, 'text');
  process.env.https_proxy = 'https://proxy:8443';
  const payload = {
    url: 'http://test.stub',
  };
  return request
    .makeRequest(payload)
    .then((response) => {
      t.deepEquals(
        response,
        { res: { statusCode: 200 }, body: 'text' },
        'response ok',
      );
      t.ok(
        needleStub.calledWith(
          'get', // default
          'https://test.stub/', // turns http to https and appends /
          sinon.match.falsy, // no data
          sinon.match({
            headers: sinon.match({
              'x-snyk-cli-version': sinon.match.string, // dynamic version
              'content-encoding': undefined, // should not set when no data
              'content-length': undefined, // should not be set when no data
            }),
            follow_max: 5, // default
            timeout: 300000, // default
            json: undefined, // default
            agent: sinon.match.truthy,
            rejectUnauthorized: undefined, // should not be set when not use insecure mode
          }),
          sinon.match.func, // callback function
        ),
        'needle called as expected',
      );
    })
    .catch((e) => t.fail('should not throw error', e));
});

test('request with http proxy calls needle as expected', (t) => {
  needleStub.yields(null, { statusCode: 200 }, 'text');

  // NO_PROXY is set in CircleCI and brakes test purpose
  const tmpNoProxy = process.env.NO_PROXY;
  delete process.env.NO_PROXY;

  // Restore env variables
  t.teardown(() => {
    process.env.NO_PROXY = tmpNoProxy;
  });

  process.env.http_proxy = 'http://proxy:8080';
  const payload = {
    url: 'http://localhost',
  };
  return request
    .makeRequest(payload)
    .then((response) => {
      t.deepEquals(
        response,
        { res: { statusCode: 200 }, body: 'text' },
        'response ok',
      );
      t.ok(
        needleStub.calledWith(
          'get', // default
          'http://localhost', // turns http to https and appends /
          sinon.match.falsy, // no data
          sinon.match({
            headers: sinon.match({
              'x-snyk-cli-version': sinon.match.string, // dynamic version
              'content-encoding': undefined, // should not set when no data
              'content-length': undefined, // should not be set when no data
            }),
            follow_max: 5, // default
            timeout: 300000, // default
            json: undefined, // default
            agent: sinon.match.truthy,
            rejectUnauthorized: undefined, // should not be set when not use insecure mode
          }),
          sinon.match.func, // callback function
        ),
        'needle called as expected',
      );
    })
    .catch((e) => t.fail('should not throw error', e));
});

test('request with no proxy calls needle as expected', (t) => {
  needleStub.yields(null, { statusCode: 200 }, 'text');
  process.env.http_proxy = 'http://proxy:8080';
  process.env.no_proxy = 'localhost';
  const payload = {
    url: 'http://localhost',
  };
  return request
    .makeRequest(payload)
    .then((response) => {
      t.deepEquals(
        response,
        { res: { statusCode: 200 }, body: 'text' },
        'response ok',
      );
      t.ok(
        needleStub.calledWith(
          'get', // default
          'http://localhost', // turns http to https and appends /
          sinon.match.falsy, // no data
          sinon.match({
            headers: sinon.match({
              'x-snyk-cli-version': sinon.match.string, // dynamic version
              'content-encoding': undefined, // should not set when no data
              'content-length': undefined, // should not be set when no data
            }),
            follow_max: 5, // default
            timeout: 300000, // default
            json: undefined, // default
            agent: sinon.match.instanceOf(http.Agent),
            rejectUnauthorized: undefined, // should not be set when not use insecure mode
          }),
          sinon.match.func, // callback function
        ),
        'needle called as expected',
      );
    })
    .catch((e) => t.fail('should not throw error', e));
});

test('request with insecure calls needle as expected', (t) => {
  needleStub.yields(null, { statusCode: 200 }, 'text');
  global.ignoreUnknownCA = true;
  const payload = {
    url: 'http://test.stub',
  };
  return request
    .makeRequest(payload)
    .then((response) => {
      t.deepEquals(
        response,
        { res: { statusCode: 200 }, body: 'text' },
        'response ok',
      );
      t.ok(
        needleStub.calledWith(
          'get', // default
          'https://test.stub/', // turns http to https and appends /
          sinon.match.falsy, // no data
          sinon.match({
            headers: sinon.match({
              'x-snyk-cli-version': sinon.match.string, // dynamic version
              'content-encoding': undefined, // should not set when no data
              'content-length': undefined, // should not be set when no data
            }),
            follow_max: 5, // default
            timeout: 300000, // default
            json: undefined, // default
            agent: sinon.match.instanceOf(http.Agent),
            rejectUnauthorized: false, // should be false when insecure mode enabled
          }),
          sinon.match.func, // callback function
        ),
        'needle called as expected',
      );
    })
    .catch((e) => t.fail('should not throw error', e));
});

test('request rejects if needle fails', (t) => {
  needleStub.yields(
    'Unexpected Error',
    { statusCode: 500 },
    'Internal Server Error',
  );
  const payload = {
    url: 'http://test.stub',
  };
  return request
    .makeRequest(payload)
    .then(() => t.fail('should have failed'))
    .catch((e) => {
      t.equals(e, 'Unexpected Error', 'rejects error');
    });
});

test('request calls needle as expected and will not update HTTP to HTTPS if envvar is set', (t) => {
  process.env.SNYK_HTTP_PROTOCOL_UPGRADE = '0';
  needleStub.yields(null, { statusCode: 200 }, 'text');
  const payload = {
    url: 'http://test.stub',
  };
  return request
    .makeRequest(payload)
    .then((response) => {
      process.env.SNYK_HTTP_PROTOCOL_UPGRADE = '1';
      t.deepEquals(
        response,
        { res: { statusCode: 200 }, body: 'text' },
        'response ok',
      );
      t.ok(
        needleStub.calledWith(
          'get', // default
          'http://test.stub', // won't upgrade http to https
          sinon.match.falsy, // no data
          sinon.match({
            headers: sinon.match({
              'x-snyk-cli-version': sinon.match.string, // dynamic version
              'content-encoding': undefined, // should not set when no data
              'content-length': undefined, // should not be set when no data
            }),
            follow_max: 5, // default
            timeout: 300000, // default
            json: undefined, // default
            agent: sinon.match.instanceOf(http.Agent),
            rejectUnauthorized: undefined, // should not be set when not use insecure mode
          }),
          sinon.match.func, // callback function
        ),
        'needle called as expected',
      );
    })
    .catch((e) => t.fail('should not throw error', e));
});
