import { fakeServer, getFirstIPv4Address } from '../../acceptance/fake-server';
import { runSnykCLI } from '../util/runSnykCLI';
import { getServerPort } from '../util/getServerPort';

jest.setTimeout(1000 * 30);

const LIFECYCLE_COMMANDS = ['install', 'uninstall'];

describe('install and uninstall workflows', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string | undefined>;
  const baseApi = '/api/v1';
  const port = getServerPort(process);
  const snykOrg = '11111111-2222-3333-4444-555555555555';
  const snykToken = '123456789';
  const fakeServerIp = getFirstIPv4Address();

  beforeAll((done) => {
    env = {
      ...process.env,
      SNYK_API: `http://${fakeServerIp}:${port}${baseApi}`,
      SNYK_HOST: `http://${fakeServerIp}:${port}`,
      SNYK_TOKEN: snykToken,
      SNYK_CFG_ORG: snykOrg,
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
    };
    server = fakeServer(baseApi, snykToken);
    server.listen(port, () => {
      done();
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => {
      done();
    });
  });

  it.each(LIFECYCLE_COMMANDS)(
    'snyk %s succeeds when no lifecycle steps are registered',
    async (command) => {
      const { code } = await runSnykCLI(command, { env });

      // today the unknown command falls back to the legacy CLI, which fails
      expect(code).toBe(0);
    },
  );

  it.each(LIFECYCLE_COMMANDS)(
    'snyk %s is a known command in analytics',
    async (command) => {
      await runSnykCLI(command, { env });

      const instrumentationRequest = server
        .getRequests()
        .filter((value) =>
          (value.url as string).includes(
            `/api/hidden/orgs/${snykOrg}/analytics`,
          ),
        )
        .pop();

      expect(
        instrumentationRequest?.body.data.attributes.interaction.categories,
      ).toContain(command);
    },
  );

  it.each(LIFECYCLE_COMMANDS)(
    'snyk %s --help says it runs post-install actions provided by extensions, not package installs',
    async (command) => {
      // TODO: the help text source is an open decision (see the open questions); this assertion is the acceptance check.
      const { code, stdout } = await runSnykCLI(`${command} --help`, { env });

      expect(code).toBe(0);
      expect(stdout).toContain('post-install actions provided by extensions');
      expect(stdout).toContain('not package installs');
    },
  );
});
