var sinon = require('sinon');
var needle = require('needle');
var tap = require('tap');
var test = tap.test;

var cli = require('../cli/commands');

test('"snyk test --severity-threshold=high"', function(t) {

  var requestStub = sinon.stub(needle, 'request', function () {throw 'bail'});
  t.teardown(() => {
    requestStub.restore();
  })

  var options = { 'severityThreshold': 'high' };
  return cli.test('ionic@1.6.5', options)
    .catch(function (error) {
      // stub is throwing an error as we need to check query params only
      t.true(requestStub.called)
      t.match(requestStub.args[0][1], 'severityThreshold=high', 'severity threshold is passed as a query param');
    })
});

test('"snyk test --severity-threshold=non-sense"', function(t) {
  var options = { 'severityThreshold': 'non-sense' };
  return cli.test('ionic@1.6.5', options)
    .catch(function (error) {
      t.equal(error.message, 'INVALID_SEVERITY_THRESHOLD', 'non-existing severity level is caught');
    })
});
