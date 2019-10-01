import * as updateNotifier from 'update-notifier';
import * as fs from 'fs';
import * as p from 'path';

export function updateCheck() {
  const pkgPath = p.join(__dirname, '../..', 'package.json');
  const isPkgFilePresent = fs.existsSync(pkgPath);

  if (!isPkgFilePresent) {
    return false;
  }

  const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'));

  // if there's no version (f.e. during tests) - do not proceed
  if (!pkg.version) {
    return false;
  }

  // Checks for available update and returns an instance
  // Default updateCheckInterval is once a day
  const notifier = updateNotifier({ pkg });
  notifier.notify();
  return true;
}
