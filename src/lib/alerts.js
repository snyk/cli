const chalk = require('chalk');

const registeredAlerts = [];

function registerAlerts(alerts) {
  if (!alerts) {
    return;
  }
  alerts.forEach((alert) => {
    if (!hasAlert(alert.name)) {
      registeredAlerts.push(alert);
    }
  });
}

function hasAlert(name) {
  let alertFound = false;
  for (let i = 0; i < registeredAlerts.length; i++) {
    if (registeredAlerts[i].name === name) {
      alertFound = true;
      break;
    }
  }
  return alertFound;
}

function displayAlerts() {
  let res = '';
  const sep = '\n';
  registeredAlerts.forEach((alert) => {
    res += sep;
    if (alert.type === 'warning') {
      res += chalk.bold.red(alert.msg);
    } else {
      res += chalk.yellow(alert.msg);
    }
  });

  return res;
}

module.exports = {
  registerAlerts: registerAlerts,
  hasAlert: hasAlert,
  displayAlerts: displayAlerts,
};
