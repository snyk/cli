import { runSnykCLI } from '../util/runSnykCLI';
import * as fs from 'fs';
import { runCommand } from '../util/runCommand';
import { fakeServer } from '../../../test/acceptance/fake-server';

jest.setTimeout(1000 * 60 * 2);
describe('Extra CA certificates specified with `NODE_EXTRA_CA_CERTS`', () => {
  it('using a not existing file', async () => {
    const { code } = await runSnykCLI(`woof --debug`, {
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: 'doesntexist.crt',
      },
    });

    expect(code).toBe(0);
  });

  it('using an invalid file', async () => {
    const filename = 'someotherfile.txt';
    const writeStream = fs.createWriteStream(filename);
    writeStream.write('Hello World');
    writeStream.end();

    const { code } = await runSnykCLI(`woof --debug`, {
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: filename,
      },
    });

    expect(code).toBe(0);
    fs.unlink(filename, () => {});
  });

  it('using a valid cert file', async () => {
    // generate certificate
    const res = await runCommand(
      'go',
      ['run', 'cmd/make-cert/main.go', 'mytestcert'],
      { cwd: 'cliv2', env: { ...process.env, SNYK_DNS_NAMES: 'localhost' } },
    );

    console.debug(res.stderr);
    expect(res.code).toBe(0);

    // setup https server
    const port = 2132;
    const token = '1234';
    const baseApi = '/api/v1';
    const SNYK_API = 'https://localhost:' + port + baseApi;
    const server = fakeServer(baseApi, token);
    const certPem = fs.readFileSync('cliv2/mytestcert.pem');
    const keyPem = fs.readFileSync('cliv2/mytestcert.key');

    await server.listenWithHttps(port, { cert: certPem, key: keyPem });

    // invoke WITHOUT additional certificate set => fails
    const res1Promise = runSnykCLI(`test --debug`, {
      env: {
        ...process.env,
        SNYK_API: SNYK_API,
        SNYK_TOKEN: token,
      },
    });

    // invoke WITH additional certificate set => succeeds
    const res2Promise = runSnykCLI(`test --debug`, {
      env: {
        ...process.env,
        NODE_EXTRA_CA_CERTS: 'cliv2/mytestcert.crt',
        SNYK_API: SNYK_API,
        SNYK_TOKEN: token,
      },
    });

    // invoke WITHOUT additional certificate set => succeeds
    const res3Promise = runSnykCLI(
      `sbom --debug --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json`,
      {
        env: {
          ...process.env,
          SNYK_API: SNYK_API,
          SNYK_TOKEN: token,
        },
      },
    );

    // invoke WITH additional certificate set => succeeds
    const res4Promise = runSnykCLI(
      `sbom --debug --org aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee --format cyclonedx1.4+json`,
      {
        env: {
          ...process.env,
          NODE_EXTRA_CA_CERTS: 'cliv2/mytestcert.crt',
          SNYK_API: SNYK_API,
          SNYK_TOKEN: token,
        },
      },
    );

    const [res1, res2, res3, res4] = await Promise.all([
      res1Promise,
      res2Promise,
      res3Promise,
      res4Promise,
    ]);

    await server.closePromise();

    expect(res1.code).toBe(2);
    expect(res2.code).toBe(0);
    expect(res3.code).toBe(2);
    expect(res4.code).toBe(0);

    fs.unlinkSync('cliv2/mytestcert.crt');
    fs.unlinkSync('cliv2/mytestcert.key');
    fs.unlinkSync('cliv2/mytestcert.pem');
  });
});
