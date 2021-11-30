import Debug from 'debug';
import { exec } from 'child_process';
import { CustomError } from './errors';

const debug = Debug('snyk');

export function yarn(
  method: string,
  packages: string[],
  live: boolean,
  cwd: string,
  flags: string[],
) {
  flags = flags || [];
  if (!packages) {
    packages = [];
  }

  if (!Array.isArray(packages)) {
    packages = [packages];
  }

  method += ' ' + flags.join(' ');

  return new Promise((resolve, reject) => {
    const cmd = 'yarn ' + method + ' ' + packages.join(' ');
    if (!cwd) {
      cwd = process.cwd();
    }
    debug('%s$ %s', cwd, cmd);

    if (!live) {
      debug('[skipping - dry run]');
      return resolve();
    }

    exec(
      cmd,
      {
        cwd,
      },
      (error, stdout, stderr) => {
        if (error) {
          return reject(error);
        }

        if (stderr.indexOf('ERR!') !== -1) {
          console.error(stderr.trim());
          const e = new CustomError('Yarn update issues: ' + stderr.trim());
          e.strCode = 'FAIL_UPDATE';
          e.code = 422;
          return reject(e);
        }

        debug('yarn %s complete', method);

        resolve();
      },
    );
  });
}
