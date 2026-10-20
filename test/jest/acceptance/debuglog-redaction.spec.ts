import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';
import { fakeServer } from '../../acceptance/fake-server';
import { getAvailableServerPort } from '../util/getServerPort';
import { runSnykCLIWithArray } from '../util/runSnykCLI';

jest.setTimeout(60_000);

describe('debug log JSON redaction', () => {
  let server;
  let home: string;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const api = `http://127.0.0.1:${port}`;
    home = fs.mkdtempSync(path.join(os.tmpdir(), 'snyk-debug-redaction-'));
    env = {
      ...(process.env as Record<string, string>),
      HOME: home,
      LOCALAPPDATA: home,
      SNYK_API: api,
      SNYK_HOST: api,
      SNYK_TOKEN: 'synthetic-token-729',
      SNYK_DISABLE_ANALYTICS: '1',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      REDACTION_TEST_TERM: 'nworld',
    };
    server = fakeServer('/api/v1', env.SNYK_TOKEN);
    await new Promise<void>((resolve) => server.listen(port, resolve));
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => server.close(() => resolve()));
    fs.rmSync(home, { recursive: true, force: true });
  });

  it('keeps trace events with escape-adjacent terms readable and secrets redacted', async () => {
    // The malformed API body exercises logging while preserving whoami's failure exit.
    server.setEndpointResponse(
      '/rest/self',
      `qzxvSentinel729\nworld ${env.SNYK_TOKEN}`,
    );

    const { code, stderr } = await runSnykCLIWithArray(
      ['whoami', '--experimental', '-d', '--log-level=trace'],
      { env },
    );

    expect(code).toBe(2);
    expect(stderr).toContain('qzxvSentinel729');
    expect(stderr).toContain('main -');
    expect(stderr).not.toContain('cannot decode event');
    expect(stderr).not.toContain(env.SNYK_TOKEN);
  });
});
