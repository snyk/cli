import { runSnykCLI } from '../util/runSnykCLI';
import { isCLIV2 } from '../util/isCLIV2';

const fakeServerPort = 12345;
const SNYK_API_HTTPS = 'https://snyk.io/api/v1';
const SNYK_API_HTTP = 'http://snyk.io/api/v1';
const FAKE_HTTP_PROXY = `http://localhost:${fakeServerPort}`;

jest.setTimeout(1000 * 60 * 1);
describe('Proxy configuration behavior', () => {
  describe('*_PROXY against HTTPS host', () => {
    it('tries to connect to the HTTPS_PROXY when HTTPS_PROXY is set', async () => {
      const { code, stderr } = await runSnykCLI(`woof --debug`, {
        env: {
          ...process.env,
          HTTPS_PROXY: FAKE_HTTP_PROXY,
          SNYK_API: SNYK_API_HTTPS,
        },
      });

      expect(code).toBe(0);

      // It will *attempt* to connect to a FAKE_HTTP_PROXY (and fails, because it's not a real proxy server)

      // When running this test against a v2 artifact, we need to look for a message like:
      //   - locally (darwin_amd64): `Cannot read TLS response from mitm'd server proxyconnect tcp: dial tcp 127.0.0.1:12345: connect: connection refused`
      //   - on Windows in CirclCI: `Cannot read TLS response from mitm'd server proxyconnect tcp: dial tcp [::1]:12345: connectex: No connection could be made because the target machine actively refused it`
      //   - on some other systems in CirclCI: `Cannot read TLS response from mitm'd server proxyconnect tcp: dial tcp [::1]:12345: connect: connection refused`
      // Here is a regex that matches any of these scenarios:
      const cliv2MessageRegex = new RegExp(
        `Cannot read TLS response from mitm'd server proxyconnect tcp: dial tcp (127\\.0\\.0\\.1|\\[::1\\]):${fakeServerPort}: (connectex: No connection could be made|connect: connection refused)`,
      );
      // When running this for v1, the message is more predictable:
      // `Error: connect ECONNREFUSED 127.0.0.1:${fakeServerPort}`
      const expectedMessageRegex = isCLIV2()
        ? cliv2MessageRegex
        : `Error: connect ECONNREFUSED 127.0.0.1:${fakeServerPort}`;
      expect(stderr).toMatch(expectedMessageRegex);
    });

    it('does not try to connect to the HTTP_PROXY when it is set', async () => {
      const { code, stderr } = await runSnykCLI(`woof -d`, {
        env: {
          ...process.env,
          HTTP_PROXY: FAKE_HTTP_PROXY,
          SNYK_API: SNYK_API_HTTPS,
        },
      });

      expect(code).toBe(0);

      // It will *not attempt* to connect to a proxy and /analytics call won't fail
      expect(stderr).not.toContain('ECONNREFUSED');
    });
  });

  describe('*_PROXY against HTTP host', () => {
    if (!isCLIV2()) {
      it('tries to connect to the HTTP_PROXY when HTTP_PROXY is set', async () => {
        const { code, stderr } = await runSnykCLI(`woof -d`, {
          env: {
            ...process.env,
            HTTP_PROXY: FAKE_HTTP_PROXY,
            SNYK_API: SNYK_API_HTTP,
            SNYK_HTTP_PROTOCOL_UPGRADE: '0',
          },
        });

        expect(code).toBe(0);

        // It will *attempt* to connect to a FAKE_HTTP_PROXY (and fails, because it's not a real proxy server)
        expect(stderr).toContain(
          `Error: connect ECONNREFUSED 127.0.0.1:${fakeServerPort}`,
        );
      });

      it('does not try to connect to the HTTPS_PROXY when it is set', async () => {
        const { code, stderr } = await runSnykCLI(`woof -d`, {
          env: {
            ...process.env,
            HTTPS_PROXY: FAKE_HTTP_PROXY,
            SNYK_API: SNYK_API_HTTP,
            SNYK_HTTP_PROTOCOL_UPGRADE: '0',
          },
        });

        expect(code).toBe(2);

        // Incorrect behavior when Needle tries to upgrade connection after 301 http->https and the Agent option is set to a strict http/s protocol.
        // See lines with `keepAlive` in request.ts for more details
        expect(stderr).toContain(
          'TypeError [ERR_INVALID_PROTOCOL]: Protocol "https:" not supported. Expected "http:"',
        );
      });
    }
  });
});
