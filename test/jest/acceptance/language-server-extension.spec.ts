import { runSnykCLI } from '../util/runSnykCLI';
import { pathToFileURL } from 'url';
import { sleep } from '../../../src/lib/common';
import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';

jest.setTimeout(1000 * 60);

describe('Language Server Extension', () => {
  it('get ls licenses', async () => {
    const result = await runSnykCLI('language-server --licenses -d');
    if (result.code != 0) {
      console.debug(result.stderr);
      console.debug(result.stdout);
    }
    expect(result.code).toBe(0);
  });

  it('get ls version', async () => {
    const cliResult = await runSnykCLI('-v');
    const result = await runSnykCLI('language-server -v -d');
    if (result.code != 0) {
      console.debug(result.stderr);
      console.debug(result.stdout);
    }
    expect(result.code).toBe(0);
    expect(cliResult.code).toBe(0);
    expect(result.stdout).not.toEqual(cliResult.stdout);
  });

  it('run and wait for diagnostics', async () => {
    let cmd = '';
    if (process.env.TEST_SNYK_COMMAND !== undefined) {
      cmd = process.env.TEST_SNYK_COMMAND;
    }

    const cli = cp.spawn(cmd, ['language-server'], { stdio: 'pipe' }); // Use stdin and stdout for communication:

    const connection = rpc.createMessageConnection(
      new rpc.StreamMessageReader(cli.stdout),
      new rpc.StreamMessageWriter(cli.stdin),
    );

    // create an RPC endpoint for the process
    connection.listen();

    await connection.sendRequest('initialize', {
      processId: process.pid,
      capabilities: {
        window: {
          workDoneProgress: true,
        },
      },
      clientInfo: {
        name: 'FakeIDE',
        version: '4.5.6',
      },
      workspaceFolders: [
        {
          name: 'workspace',
          uri: pathToFileURL('.').href,
        },
      ],
      rootUri: null,
      initializationOptions: {
        activateSnykCodeSecurity: 'false',
        activateSnykCodeQuality: 'false',
        activateSnykOpenSource: 'true',
        activateSnykIac: 'false',
        token: process.env.TEST_SNYK_TOKEN,
        manageBinariesAutomatically: 'false',
        enableTrustedFoldersFeature: 'false',
        integrationName: 'MyFakePlugin',
        integrationVersion: '1.2.3',
        enableTelemetry: 'false',
        cliPath: cmd,
      },
    });

    let diagnosticCount = 0;
    connection.onNotification(
      'textDocument/publishDiagnostics',
      (param: string) => {
        console.debug('Received notification: ' + param);
        diagnosticCount++;
      },
    );

    // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-empty-function
    connection.onNotification('window/logMessage', (_: string) => {});

    // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-empty-function
    connection.onNotification((_: string) => {});

    // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-empty-function
    connection.onRequest((_: string) => {});

    await connection.sendRequest('initialized', {});

    for (let i = 0; i < 45; i++) {
      console.debug('Waiting for diagnostics...');
      if (diagnosticCount > 0) {
        break;
      }
      await sleep(1000);
    }

    cli.kill(9);
  });
});
