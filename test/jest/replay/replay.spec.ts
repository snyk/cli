import { back as nockBack } from 'nock';
import { args as argsLib } from '../../../dist/cli/args';
import { cartesian } from './cartesian';

// tslint:disable-next-line:no-var-requires
const sanitizeFilename = require('sanitize-filename');

nockBack.fixtures = __dirname + '/nock_fixtures';

describe('replay', () => {
  nockBack.setMode('lockdown'); // switch to `record` for recording more tests

  beforeAll(async () => {
    await run('help'); // this will load all modules into memory
  });

  const testCases: string[] = cartesian(
    ['test'],
    ['test/acceptance/workspaces/yarn-package', 'test/acceptance/workspaces/npm-package'],
    ['', '--json', '--sarif'],
  );

  it.each(testCases)(
    '%p',
    async (command) => {
      const nockFixtureName = `${sanitizeFilename(command)}.json`;
      const { nockDone } = await nockBack(nockFixtureName);
      const logs = [] as any[];
      try {
        await run(command, logs);
        const nockError = logs.find((x) => String(x).includes('Nock:'));
        if (nockError) {
          throw nockError;
        }
      } finally {
        nockDone();
        expect(logs).toMatchSnapshot('logs');
      }
    },
    100000,
  );

  async function run(command: string, logs: any[] = []) {
    console.log = (...args) => logs.push(...args);
    console.error = (...args) => logs.push(...args);
    const runArgs = argsLib(['node', 'index.js', ...command.split(' ')]);
    const { main: runCli } = require('../../../dist/cli/index');
    await runCli(runArgs).catch((...err) => console.error(...err));
  }
});
