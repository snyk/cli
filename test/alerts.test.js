var test = require('tap-only');
var testUtils = require('./utils');
var alerts = require('../lib/alerts');

var exampleAlert = function (id, type) {
  type = type || 'info';
  return {
    msg: 'Example alert ' + id,
    type: type,
  };
}

test('register an alert', function (t) {
  t.plan(1);

  alerts.registerAlerts([ exampleAlert(1) ]);
  t.equal(alerts.displayAlerts().trim(), exampleAlert(1).msg,
    'alert is displayed');
});

test('register the same alert multiple times', function (t) {
  t.plan(1);

  alerts.registerAlerts([ exampleAlert(1) ]);
  alerts.registerAlerts([ exampleAlert(1) ]);
  t.equal(alerts.displayAlerts().trim(), exampleAlert(1).msg,
    'alert is only displayed once');
});

test('register two different alerts', function (t) {
  t.plan(2);

  alerts.registerAlerts([ exampleAlert(1) ]);
  alerts.registerAlerts([ exampleAlert(2) ]);
  const displayedAlerts = alerts.displayAlerts();
  t.contains(displayedAlerts, exampleAlert(1).msg,
    'first alert is displayed');
  t.contains(displayedAlerts, exampleAlert(2).msg,
    'second alert is displayed');
});
