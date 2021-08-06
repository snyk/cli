import * as tap from 'tap';
import * as Proxyquire from 'proxyquire';
import * as sinon from 'sinon';
import * as snyk from '../src/lib';
let old;
const proxyquire = Proxyquire.noPreserveCache();
const { test } = tap;

tap.beforeEach((done) => {
  old = snyk.config.get('disable-analytics');
  snyk.config.delete('disable-analytics');
  done();
});

tap.afterEach((done) => {
  if (old === undefined) {
    snyk.config.delete('disable-analytics');
  } else {
    snyk.config.set('disable-analytics', old);
  }
  done();
});

test('analyticsAllowed returns false if disable-analytics set in snyk config', (t) => {
  t.plan(1);
  snyk.config.set('disable-analytics', '1');
  const analytics = require('../src/lib/analytics');
  const analyticsAllowed: boolean = analytics.allowAnalytics();
  t.notOk(analyticsAllowed);
});

test('analyticsAllowed returns true if disable-analytics is not set snyk config', (t) => {
  t.plan(1);
  const analytics = require('../src/lib/analytics');
  const analyticsAllowed: boolean = analytics.allowAnalytics();
  t.ok(analyticsAllowed);
});

test('analytics disabled', (t) => {
  const spy = sinon.spy();
  snyk.config.set('disable-analytics', '1');
  const analytics = proxyquire('../src/lib/analytics', {
    '../request': {
      makeRequest: spy,
    },
  });

  return analytics.addDataAndSend().then(() => {
    t.equal(spy.called, false, 'the request should not have been made');
  });
});
