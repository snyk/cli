import { exec } from 'child_process';
import { sep } from 'path';
const main = './dist/cli/index.js'.replace(/\//g, sep);

const SNYK_API_HTTPS = 'https://snyk.io/api/v1';
const SNYK_API_HTTP = 'http://snyk.io/api/v1';
const FAKE_HTTP_PROXY = 'http://localhost:12345';
const testTimeout = 50000;

describe('Proxy configuration behavior', () => {
  describe('*_PROXY against HTTPS host', () => {
    it(
      'tries to connect to the HTTPS_PROXY when HTTPS_PROXY is set',
      (done) => {
        exec(
          `node ${main} woof -d`,
          {
            env: {
              HTTPS_PROXY: FAKE_HTTP_PROXY,
              SNYK_API: SNYK_API_HTTPS,
            },
          },
          (err, stdout, stderr) => {
            if (err) {
              throw err;
            }

            // It will *attempt* to connect to a FAKE_HTTP_PROXY (and fails, because it's not a real proxy server)
            expect(stderr).toContain(
              `Error: connect ECONNREFUSED 127.0.0.1:${
                FAKE_HTTP_PROXY.split(':')[2]
              }`,
            );
            done();
          },
        );
      },
      testTimeout,
    );

    it(
      'does not try to connect to the HTTP_PROXY when it is set',
      (done) => {
        exec(
          `node ${main} woof -d`,
          {
            env: {
              HTTP_PROXY: FAKE_HTTP_PROXY,
              SNYK_API: SNYK_API_HTTPS,
            },
          },
          (err, stdout, stderr) => {
            if (err) {
              throw err;
            }

            // It will *not attempt* to connect to a proxy and /analytics call won't fail
            expect(stderr).not.toContain('ECONNREFUSED');
            done();
          },
        );
      },
      testTimeout,
    );
  });

  describe('*_PROXY against HTTP host', () => {
    it(
      'tries to connect to the HTTP_PROXY when HTTP_PROXY is set',
      (done) => {
        exec(
          `node ${main} woof -d`,
          {
            env: {
              HTTP_PROXY: FAKE_HTTP_PROXY,
              SNYK_API: SNYK_API_HTTP,
              SNYK_HTTP_PROTOCOL_UPGRADE: '0',
            },
          },
          (err, stdout, stderr) => {
            if (err) {
              throw err;
            }

            // It will *attempt* to connect to a FAKE_HTTP_PROXY (and fails, because it's not a real proxy server)
            expect(stderr).toContain(
              `Error: connect ECONNREFUSED 127.0.0.1:${
                FAKE_HTTP_PROXY.split(':')[2]
              }`,
            );
            done();
          },
        );
      },
      testTimeout,
    );

    it(
      'does not try to connect to the HTTPS_PROXY when it is set',
      (done) => {
        exec(
          `node ${main} woof -d`,
          {
            env: {
              HTTPS_PROXY: FAKE_HTTP_PROXY,
              SNYK_API: SNYK_API_HTTP,
              SNYK_HTTP_PROTOCOL_UPGRADE: '0',
            },
          },
          (err, stdout, stderr) => {
            // TODO: incorrect behavior when Needle tries to upgrade connection after 301 http->https and the Agent option is set to a strict http/s protocol
            // See lines with `keepAlive` in request.ts for more details
            expect(stderr).toContain(
              'TypeError [ERR_INVALID_PROTOCOL]: Protocol "https:" not supported. Expected "http:"',
            );
            done();
          },
        );
      },
      testTimeout,
    );
  });
});
