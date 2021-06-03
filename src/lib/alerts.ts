import chalk from 'chalk';

export type AlertType = 'info' | 'warning' | 'error';

export interface Alert {
  type: AlertType;
  name: string;
  msg: string;
}

const registeredAlerts: Alert[] = [];

function registerAlerts(alerts: Alert[]) {
  if (!alerts) {
    return;
  }
  alerts.forEach((alert) => {
    if (!hasAlert(alert.name)) {
      registeredAlerts.push(alert);
    }
  });
}

function hasAlert(name: string): boolean {
  return registeredAlerts.some((a) => a.name === name);
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

export { registerAlerts, hasAlert, displayAlerts };
