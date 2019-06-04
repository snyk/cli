import {test} from 'tap';
import {exec} from 'child_process';
import * as userConfig from '../../src/lib/user-config';

test('`protect` should not fail for unauthorized users', (t) => {
  t.plan(1);

  const apiUserConfig = userConfig.get('api');
  // temporally remove api param in userConfig to test for unauthenticated users
  userConfig.delete('api');

  exec('node ./dist/cli/index.js protect', (_, stdout) => {
    t.equal(stdout.trim(), 'Successfully applied Snyk patches', 'correct output for unauthenticated user');

    // Restore api param
    userConfig.set('api', apiUserConfig);
  });
});
