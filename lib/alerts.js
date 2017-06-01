var chalk = require('chalk');

var registeredAlerts = [];

function registerAlerts (alerts) {
  if (!alerts) {
    return;
  }
  alerts.forEach(function (alert) {
    if (!hasAlert(alert.name)) {
      registeredAlerts.push(alert);
    }
  });
}

function hasAlert(name) {
  var alertFound = false;
  for (var i = 0; i < registeredAlerts.length; i++) {
    if (registeredAlerts[i].name === name) {
      alertFound = true;
      break;
    }
  }
  return alertFound;
}

function displayAlerts () {
  var res = '';
  var sep = '\n';
  registeredAlerts.forEach(function (alert) {
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
