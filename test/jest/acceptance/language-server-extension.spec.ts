import { runSnykCLI } from '../util/runSnykCLI';
import * as path from 'path';
import { pathToFileURL } from 'url';
import { sleep } from '../../../src/lib/common';
import * as cp from 'child_process';
import * as rpc from 'vscode-jsonrpc/node';
import { withFipsEnvIfNeeded } from '../util/fipsTestHelper';
import { requireSnykToken } from '../util/requireSnykToken';

jest.setTimeout(1000 * 120);

/** snyk-ls v25+ wire type: only entries with `changed: true` are applied (see ConfigSetting in snyk-ls). */
function lspConfigSetting(value: unknown): {
  value: unknown;
  changed: boolean;
} {
  return { value, changed: true };
}

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
    const token = requireSnykToken();
    let cmd = '';
    if (process.env.TEST_SNYK_COMMAND !== undefined) {
      cmd = process.env.TEST_SNYK_COMMAND;
    }
    if (!cmd) {
      throw new Error(
        'Set TEST_SNYK_COMMAND to the built CLI binary (e.g. ./binary-releases/snyk-macos-arm64).',
      );
    }

    const cli = cp.spawn(cmd, ['language-server'], {
      stdio: 'pipe', // Use stdin and stdout for communication:
      env: withFipsEnvIfNeeded(),
    });

    let processExited = false;
    cli.on('exit', (code, signal) => {
      console.debug(`CLI process exited with code: ${code}, signal: ${signal}`);
      processExited = true;
    });

    const connection = rpc.createMessageConnection(
      new rpc.StreamMessageReader(cli.stdout),
      new rpc.StreamMessageWriter(cli.stdin),
    );

    const workspaceFixture = path.resolve(
      path.join(__dirname, '../../fixtures/npm/with-vulnerable-lodash-dep'),
    );
    const cliPathResolved = path.resolve(cmd);

    // Keys are internal/pflag names (see internal/types/ldx_sync_config.go in snyk-ls@f9b48c0d538f).
    const initOptions = {
      settings: {
        // Falls back to production API if TEST_SNYK_API is unset.
        api_endpoint: lspConfigSetting(
          process.env.TEST_SNYK_API ?? 'https://api.snyk.io',
        ),
        token: lspConfigSetting(token),
        authentication_method: lspConfigSetting('token'),
        automatic_authentication: lspConfigSetting(false),
        trust_enabled: lspConfigSetting(true),
        trusted_folders: lspConfigSetting([workspaceFixture]),
        snyk_oss_enabled: lspConfigSetting(true),
        snyk_code_enabled: lspConfigSetting(false),
        snyk_iac_enabled: lspConfigSetting(false),
        snyk_secrets_enabled: lspConfigSetting(false),
        automatic_download: lspConfigSetting(false),
        cli_path: lspConfigSetting(cliPathResolved),
        scan_automatic: lspConfigSetting(true),
        send_error_reports: lspConfigSetting(false),
      },
      // Top-level LSP extension fields — not ConfigSetting-wrapped pflag values.
      integrationName: 'MyFakePlugin',
      integrationVersion: '1.2.3',
    };

    // create an RPC endpoint for the process
    connection.listen();

    let diagnosticCount = 0;
    try {
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
            uri: pathToFileURL(workspaceFixture).href,
          },
        ],
        rootUri: null,
        initializationOptions: initOptions,
      });

      connection.onNotification(
        'textDocument/publishDiagnostics',
        (param: string) => {
          console.debug('Received notification: ' + JSON.stringify(param));
          diagnosticCount++;
        },
      );

      // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-empty-function
      connection.onNotification('window/logMessage', (_: string) => {});

      // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-empty-function
      connection.onNotification((_: string) => {});

      // eslint-disable-next-line @typescript-eslint/no-unused-vars,@typescript-eslint/no-empty-function
      connection.onRequest((_: string) => {});

      await connection.sendNotification('initialized', {});

      for (let i = 0; i < 45; i++) {
        console.debug('Waiting for diagnostics...');
        if (diagnosticCount > 0) {
          break;
        }
        if (processExited) {
          throw new Error('LS process exited before diagnostics arrived');
        }
        await sleep(1000);
      }
    } finally {
      cli.kill(9);
      connection.dispose();
    }

    for (let i = 0; i < 10; i++) {
      console.debug('Waiting for process to exit...');
      if (processExited) {
        break;
      }
      await sleep(1000);
    }

    expect(diagnosticCount).toBeGreaterThan(0);
  });
});
