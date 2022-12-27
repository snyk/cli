import * as fs from 'fs';
import { fakeServer, FakeServer } from '../../acceptance/fake-server';
import { createProjectFromWorkspace } from '../util/createProject';
import { getFixturePath } from '../util/getFixturePath';
import { runSnykCLI } from '../util/runSnykCLI';
import { isCLIV2 } from '../util/isCLIV2';
import * as os from 'os';

jest.setTimeout(1000 * 30);

function getFirstIPv4Address(): string {
  let ipaddress = '';

  const interfaces = os.networkInterfaces();
  for (const [, group] of Object.entries(interfaces)) {
    if (group) {
      for (const inter of group) {
        if (inter && inter.family == 'IPv4' && inter.address != '127.0.0.1') {
          ipaddress = inter.address;
          break;
        }
      }
    }
  }
  return ipaddress;
}

describe('https', () => {
  let server: FakeServer;
  let env: Record<string, string>;

  beforeAll(async () => {
    const ipaddress = getFirstIPv4Address();
    console.log('Using ip: ' + ipaddress);

    const port = process.env.PORT || process.env.SNYK_PORT || '12345';
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

  describe('expired certificate', () => {
    it('rejects connections', async () => {
      const project = await createProjectFromWorkspace('npm-package');
      const { code, stdout } = await runSnykCLI('test', {
        cwd: project.path(),
        env,
      });

      expect(stdout).toContain(
        isCLIV2()
          ? 'socket hang up' // cliv2's proxy will drop the connection, but its debug logs will say why.
          : 'certificate has expired',
      );
      expect(code).toBe(2);
    });

    it('accepts connections using --insecure', async () => {
      const project = await createProjectFromWorkspace('npm-package');
      const { code } = await runSnykCLI('test --insecure', {
        cwd: project.path(),
        env,
      });
      expect(code).toBe(0);
    });
  });
});
