import {test} from 'tap';
import alerts = require('../src/lib/alerts');

const exampleAlert = (id, type: alerts.AlertType = 'info') => {
  return {
    msg: 'Example alert ' + id,
    name: 'example-' + id,
    type,
  };
};

test('no alerts', (t) => {
  t.plan(2);

  const alert = exampleAlert(1);
  t.false(alerts.hasAlert(alert.name), 'alert is not found');
  t.equal(alerts.displayAlerts(), '', 'alerts are not displayed');
});

test('register an alert', (t) => {
  t.plan(2);

  const alert = exampleAlert(1);
  alerts.registerAlerts([ alert ]);
  t.true(alerts.hasAlert(alert.name), 'alert is found');
  t.equal(alerts.displayAlerts().trim(), alert.msg,
    'alert is displayed');
});

test('register the same alert multiple times', (t) => {
  t.plan(2);

  const alert = exampleAlert(1);
  alerts.registerAlerts([ alert ]);
  alerts.registerAlerts([ alert ]);
  t.true(alerts.hasAlert(alert.name), 'alert is found');
  t.equal(alerts.displayAlerts().trim(), alert.msg,
    'alert is only displayed once');
});

test('register two different alerts', (t) => {
  t.plan(4);

  const alert1 = exampleAlert(1);
  const alert2 = exampleAlert(2);
  alerts.registerAlerts([ alert1 ]);
  alerts.registerAlerts([ alert2 ]);
  t.true(alerts.hasAlert(alert1.name), 'first alert is found');
  t.true(alerts.hasAlert(alert2.name), 'second alert is found');
  const displayedAlerts = alerts.displayAlerts();
  t.contains(displayedAlerts, alert1.msg,
    'first alert is displayed');
  t.contains(displayedAlerts, alert2.msg,
    'second alert is displayed');
});
