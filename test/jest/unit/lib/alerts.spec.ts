import {
  Alert,
  displayAlerts,
  hasAlert,
  registerAlerts,
} from '../../../../src/lib/alerts';

const createTestAlert = (id: string): Alert => {
  return {
    msg: `Test Alert Message ${id}`,
    name: `test-alert-name-${id}`,
    type: 'info',
  };
};

test('no alerts', () => {
  const alert = createTestAlert('1');
  expect(hasAlert(alert.name)).toEqual(false);
  expect(displayAlerts()).toEqual('');
});

test('register an alert', () => {
  const alert = createTestAlert('1');
  registerAlerts([alert]);
  expect(hasAlert(alert.name)).toEqual(true);
  expect(displayAlerts()).toMatch(alert.msg);
});

test('register the same alert multiple times', () => {
  const alert = createTestAlert('1');
  registerAlerts([alert]);
  registerAlerts([alert]);
  expect(hasAlert(alert.name)).toEqual(true);
  expect(displayAlerts()).toMatch(alert.msg);
});

test('register two different alerts', () => {
  const alert1 = createTestAlert('1');
  const alert2 = createTestAlert('2');

  registerAlerts([alert1]);
  registerAlerts([alert2]);
  expect(hasAlert(alert1.name)).toEqual(true);
  expect(hasAlert(alert2.name)).toEqual(true);

  const displayedAlerts = displayAlerts();
  expect(displayedAlerts).toMatch(alert1.msg);
  expect(displayedAlerts).toMatch(alert2.msg);
});
