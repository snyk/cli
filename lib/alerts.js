var chalk = require('chalk');

var registeredAlerts = {
  infos: [],
  warnings: [],
};

module.exports.registerAlerts = function (alerts) {
  if (!alerts) {
    return;
  }
  alerts.forEach(function (alert) {
    if (alert.type === 'warning') {
      if (registeredAlerts.warnings.indexOf(alert.msg) === -1) {
        registeredAlerts.warnings.push(alert.msg);
      }
    } else {
      if (registeredAlerts.infos.indexOf(alert.msg) === -1) {
        registeredAlerts.infos.push(alert.msg);
      }
    }
  });
};

module.exports.displayAlerts = function () {
  var res = '';
  var sep = '\n';
  registeredAlerts.infos.forEach(function (msg) {
    res += sep + chalk.yellow(msg);
  });
  registeredAlerts.warnings.forEach(function (msg) {
    res += sep + chalk.bold.red(msg);
  });

  return res;
};
