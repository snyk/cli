import * as fs from 'fs';
import {
  fakeServer,
  FakeServer,
  getFirstIPv4Address,
} from '../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../util/createProject';
import { getFixturePath } from '../util/getFixturePath';
import { runSnykCLI } from '../util/runSnykCLI';
import { getServerPort } from '../util/getServerPort';
import { Snyk } from '@snyk/error-catalog-nodejs-public';
import { EXIT_CODES } from '../../../src/cli/exit-codes';

jest.setTimeout(1000 * 30);

const snykOrg = '11111111-2222-3333-4444-555555555555';

describe('https', () => {
  let server: FakeServer;
  let env: Record<string, string>;

  beforeAll(async () => {
    const ipaddress = getFirstIPv4Address();
    console.log('Using ip: ' + ipaddress);

    const port = getServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'https://' + ipaddress + ':' + port + baseApi,
      SNYK_HOST: 'https://' + ipaddress + ':' + port,
      SNYK_TOKEN: '123456789',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenWithHttps(port, {
      /**
       * key and cert were generating using the command below:
       * faketime 'last week' openssl req -new -newkey rsa:4096 -days 1 -nodes -x509 -subj '/C=US/ST=Denial/L=Springfield/O=Dis/CN=localhost' -keyout localhost-expired.key -out localhost-expired.cert
       */
      key: fs.readFileSync(getFixturePath('fake-server/localhost-expired.key')),
      cert: fs.readFileSync(
        getFixturePath('fake-server/localhost-expired.cert'),
      ),
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

  describe('invalid certificate', () => {
    it('rejects connections', async () => {
      const project = await createProjectFromWorkspace('npm-package');
      const { code } = await runSnykCLI('test', {
        cwd: project.path(),
        env,
      });
      expect(server.getRequests().length).toBe(0);
      expect(code).toBe(2);
    });

    it('accepts connections using --insecure', async () => {
      const project = await createProjectFromWorkspace('npm-package');
      const { code } = await runSnykCLI('test --insecure', {
        cwd: project.path(),
        env,
      });
      expect(server.getRequests().length).toBeGreaterThan(1);
      expect(code).toBe(0);

      // get rid of the first entry which has another User Agent
      server.getRequests().reverse().pop();

      for (const r of server.getRequests()) {
        expect(r.headers['user-agent']).toContain('snyk-cli/');
      }
    });
  });
});

describe('network', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll(async () => {
    const ipAddr = getFirstIPv4Address();
    const port = getServerPort(process);
    const baseApi = '/api/v1';

    env = {
      ...process.env,
      SNYK_API: 'http://' + ipAddr + ':' + port + baseApi,
      SNYK_TOKEN: '123456789',
      SNYK_HTTP_PROTOCOL_UPGRADE: '0',
      SNYK_CFG_ORG: snykOrg,
      INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '1', // reduce test duration by reducing retry
      INTERNAL_NETWORK_REQUEST_RETRY_AFTER_SECONDS: '1', // reduce test duration by reducing retry
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        resolve();
      });
    });
  });

  afterEach(async () => {
    server.restore();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  describe('retries', () => {
    it('respects max attempts', async () => {
      const errorResponse = {
        jsonapi: { version: '1.0' },
        errors: [new Snyk.ServerError('').toJsonApiErrorObject()],
        description: 'Internal server error',
      };
      server.setGlobalResponse(
        errorResponse,
        parseInt(errorResponse['errors'][0].status),
        { 'retry-after': '1' },
      );
      await runSnykCLI(`test`, {
        env: {
          ...env,
          INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '2',
        },
      });

      const requests = server.getRequests();
      const actualNetorkAttempts = requests.filter(
        (r) => r.url.includes('/test-dep-graph') || r.url.includes('/vuln/'),
      ).length;

      expect(actualNetorkAttempts).toBe(2);
    });

    describe('maintenance error [SNYK-0099]', () => {
      const maintenanceErrorRes = {
        jsonapi: { version: '1.0' },
        errors: [new Snyk.MaintenanceWindowError('').toJsonApiErrorObject()],
        description: 'Maintenance window',
      };

      beforeEach(() => {
        server.setGlobalResponse(
          maintenanceErrorRes,
          parseInt(maintenanceErrorRes.errors[0].status),
        );
      });

      it('does not attempt any retries', async () => {
        await runSnykCLI(`test -d --log-level=trace`, {
          env: {
            ...env,
            // apply a user configured attempts of 10
            INTERNAL_NETWORK_REQUEST_MAX_ATTEMPTS: '10',
          },
        });

        // Count how many times an endpoint was hit
        const requests = server.getRequests();
        const actualNetworkAttempts = requests.filter(
          (r) => r.url.includes('/test-dep-graph') || r.url.includes('/vuln/'),
        ).length;

        expect(actualNetworkAttempts).toBe(1);
      });

      it('returns correct exit code', async () => {
        const { code, stdout } = await runSnykCLI(`test`, {
          env,
        });

        expect(stdout).toContain(maintenanceErrorRes['errors'][0].code);
        expect(code).toEqual(EXIT_CODES.EX_TEMPFAIL);
      });
    });
  });
});
