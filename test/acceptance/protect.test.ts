import {test} from 'tap';
import {exec} from 'child_process';
import * as userConfig from '../../src/lib/user-config';
import { sep } from 'path';

const main = './dist/cli/index.js'.replace(/\//g, sep);

test('`protect` should not fail for unauthorized users', (t) => {
  t.plan(1);

  const apiUserConfig = userConfig.get('api');
  // temporally remove api param in userConfig to test for unauthenticated users
  userConfig.delete('api');

  exec(`node ${main} protect`, (err, stdout, stderr) => {
    if (err) {
      throw err;
    }
    t.equal(stdout.trim(), 'Successfully applied Snyk patches', 'correct output for unauthenticated user');

    // Restore api param
    userConfig.set('api', apiUserConfig);
  });
});
