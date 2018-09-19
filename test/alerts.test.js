var test = require('tap').test;
var testUtils = require('./utils');
var alerts = require('../src/lib/alerts');

var exampleAlert = function (id, type) {
  type = type || 'info';
  return {
    msg: 'Example alert ' + id,
    name: 'example-' + id,
    type: type,
  };
}

test('no alerts', function (t) {
  t.plan(2);

  var alert = exampleAlert(1);
  t.false(alerts.hasAlert(alert.name), 'alert is not found');
  t.equal(alerts.displayAlerts(), '', 'alerts are not displayed');
});

test('register an alert', function (t) {
  t.plan(2);

  var alert = exampleAlert(1);
  alerts.registerAlerts([ alert ]);
  t.true(alerts.hasAlert(alert.name), 'alert is found');
  t.equal(alerts.displayAlerts().trim(), alert.msg,
    'alert is displayed');
});

test('register the same alert multiple times', function (t) {
  t.plan(2);

  var alert = exampleAlert(1);
  alerts.registerAlerts([ alert ]);
  alerts.registerAlerts([ alert ]);
  t.true(alerts.hasAlert(alert.name), 'alert is found');
  t.equal(alerts.displayAlerts().trim(), alert.msg,
    'alert is only displayed once');
});

test('register two different alerts', function (t) {
  t.plan(4);

  var alert1 = exampleAlert(1);
  var alert2 = exampleAlert(2);
  alerts.registerAlerts([ alert1 ]);
  alerts.registerAlerts([ alert2 ]);
  t.true(alerts.hasAlert(alert1.name), 'first alert is found');
  t.true(alerts.hasAlert(alert2.name), 'second alert is found');
  var displayedAlerts = alerts.displayAlerts();
  t.contains(displayedAlerts, alert1.msg,
    'first alert is displayed');
  t.contains(displayedAlerts, alert2.msg,
    'second alert is displayed');
});
