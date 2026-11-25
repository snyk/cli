import { exec } from 'child_process';

// TODO: is this different to child process exec?
export function executeCommand(cmd, root) {
  return new Promise((resolve, reject) => {
    exec(cmd, { cwd: root }, (err, stdout, stderr) => {
      const error = stderr.trim();
      if (error) {
        return reject(new Error(error + ' / ' + cmd));
      }
      resolve(stdout.split('\n').join(''));
    });
  });
}
