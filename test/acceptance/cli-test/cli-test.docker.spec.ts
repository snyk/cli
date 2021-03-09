import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';

import { AcceptanceTests } from './cli-test.acceptance.test';

export const DockerTests: AcceptanceTests = {
  language: 'Docker',
  tests: {
    '`test foo:latest --docker`': (params) => async (t) => {
      const spyPlugin = stubDockerPluginResponse(
        params.ecoSystemPlugins,
        {
          scanResults: [
            {
              facts: [
                { type: 'depGraph', data: {} },
                { type: 'dockerfileAnalysis', data: {} },
              ],
              identity: {
                type: 'deb',
              },
              target: {
                image: 'docker-image|ubuntu',
              },
            },
          ],
        },
        t,
      );

      await params.cli.test('foo:latest', {
        docker: true,
        org: 'explicit-org',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dependencies', 'posts to correct url');
      t.deepEqual(
        req.body,
        {
          scanResult: {
            facts: [
              { type: 'depGraph', data: {} },
              { type: 'dockerfileAnalysis', data: {} },
            ],
            identity: {
              type: 'deb',
            },
            target: {
              image: 'docker-image|ubuntu',
            },
          },
        },
        'sends correct payload',
      );
      t.same(
        spyPlugin.getCall(0).args,
        [
          {
            docker: true,
            org: 'explicit-org',
            projectName: null,
            packageManager: null,
            path: 'foo:latest',
            showVulnPaths: 'some',
          },
        ],
        'calls docker plugin with expected arguments',
      );
    },

    '`test foo:latest --docker --platform=linux/amd64`': (params) => async (
      t,
    ) => {
      const spyPlugin = stubDockerPluginResponse(
        params.ecoSystemPlugins,
        {
          scanResults: [
            {
              facts: [
                { type: 'depGraph', data: {} },
                { type: 'dockerfileAnalysis', data: {} },
              ],
              identity: {
                type: 'deb',
                args: {
                  platform: 'linux/amd64',
                },
              },
              target: {
                image: 'docker-image|ubuntu',
              },
            },
          ],
        },
        t,
      );

      await params.cli.test('foo:latest', {
        docker: true,
        org: 'explicit-org',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dependencies', 'posts to correct url');
      t.deepEqual(
        req.body,
        {
          scanResult: {
            facts: [
              { type: 'depGraph', data: {} },
              { type: 'dockerfileAnalysis', data: {} },
            ],
            identity: {
              type: 'deb',
              args: {
                platform: 'linux/amd64',
              },
            },
            target: {
              image: 'docker-image|ubuntu',
            },
          },
        },
        'sends correct payload',
      );
      t.same(
        spyPlugin.getCall(0).args,
        [
          {
            docker: true,
            org: 'explicit-org',
            projectName: null,
            packageManager: null,
            path: 'foo:latest',
            showVulnPaths: 'some',
          },
        ],
        'calls docker plugin with expected arguments',
      );
    },

    '`test foo:latest --docker vulnerable paths`': (params) => async (t) => {
      stubDockerPluginResponse(
        params.ecoSystemPlugins,
        {
          scanResults: [
            {
              facts: [
                { type: 'depGraph', data: {} },
                { type: 'dockerfileAnalysis', data: {} },
              ],
              identity: {
                type: 'deb',
              },
              target: {
                image: 'docker-image|ubuntu',
              },
            },
          ],
        },
        t,
      );

      const vulns = require('../fixtures/docker/find-result.json');
      params.server.setNextResponse(vulns);

      try {
        await params.cli.test('foo:latest', {
          docker: true,
          org: 'explicit-org',
        });
        t.fail('should have found vuln');
      } catch (err) {
        const msg = err.message;
        t.match(
          msg,
          'Tested 2 dependencies for known vulnerabilities, found 1 vulnerability',
        );
        t.match(msg, 'From: bzip2/libbz2-1.0@1.0.6-8.1');
        t.match(
          msg,
          'From: apt/libapt-pkg5.0@1.6.3ubuntu0.1 > bzip2/libbz2-1.0@1.0.6-8.1',
        );
        t.false(
          msg.includes('vulnerable paths'),
          'docker should not includes number of vulnerable paths',
        );
      }
    },

    '`test foo:latest --docker --file=Dockerfile`': (params, utils) => async (
      t,
    ) => {
      const spyPlugin = stubDockerPluginResponse(
        params.ecoSystemPlugins,
        {
          scanResults: [
            {
              facts: [
                { type: 'depGraph', data: {} },
                {
                  type: 'dockerfileAnalysis',
                  data: {
                    baseImage: 'nginx:1.18.0',
                    dockerfilePackages: {
                      'openssl@1.5.0': {
                        instruction: 'RUN apk add openssl@1.5.0',
                      },
                    },
                    dockerfileLayers: {
                      'UlVOIGFwayBhZGQgb3BlbnNzbEAxLjUuMA==': {
                        instruction: 'RUN apk add openssl@1.5.0',
                      },
                    },
                  },
                },
              ],
              identity: {
                type: 'deb',
              },
              target: {
                image: 'docker-image|ubuntu',
              },
            },
          ],
        },
        t,
      );

      await params.cli.test('foo:latest', {
        docker: true,
        org: 'explicit-org',
        file: 'Dockerfile',
      });

      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dependencies', 'posts to correct url');
      t.deepEqual(
        req.body,
        {
          scanResult: {
            facts: [
              { type: 'depGraph', data: {} },
              {
                type: 'dockerfileAnalysis',
                data: {
                  baseImage: 'nginx:1.18.0',
                  dockerfilePackages: {
                    'openssl@1.5.0': {
                      instruction: 'RUN apk add openssl@1.5.0',
                    },
                  },
                  dockerfileLayers: {
                    'UlVOIGFwayBhZGQgb3BlbnNzbEAxLjUuMA==': {
                      instruction: 'RUN apk add openssl@1.5.0',
                    },
                  },
                },
              },
            ],
            identity: {
              type: 'deb',
            },
            target: {
              image: 'docker-image|ubuntu',
            },
          },
        },
        'sends correct payload',
      );
      t.same(
        spyPlugin.getCall(0).args,
        [
          {
            file: 'Dockerfile',
            docker: true,
            org: 'explicit-org',
            projectName: null,
            packageManager: null,
            path: 'foo:latest',
            showVulnPaths: 'some',
          },
        ],
        'calls docker plugin with expected arguments',
      );
    },

    '`test foo:latest --docker --file=Dockerfile remediation advice`': (
      params,
    ) => async (t) => {
      stubDockerPluginResponse(
        params.ecoSystemPlugins,
        {
          scanResults: [
            {
              facts: [
                { type: 'depGraph', data: {} },
                { type: 'dockerfileAnalysis', data: {} },
              ],
              identity: {
                type: 'deb',
              },
              target: {
                image: 'docker-image|ubuntu',
              },
            },
          ],
        },
        t,
      );
      const vulns = require('../fixtures/docker/find-result-remediation.json');
      params.server.setNextResponse(vulns);

      try {
        await params.cli.test('foo:latest', {
          docker: true,
          org: 'explicit-org',
          file: 'Dockerfile',
        });
        t.fail('should have found vuln');
      } catch (err) {
        const msg = err.message;
        t.match(msg, 'Base Image');
        t.match(msg, 'Recommendations for base image upgrade');
      }
    },

    '`test foo:latest --docker` doesnt collect policy from cwd': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces('npm-package-policy');
      const spyPlugin = stubDockerPluginResponse(
        params.ecoSystemPlugins,
        {
          scanResults: [
            {
              facts: [
                { type: 'depGraph', data: {} },
                { type: 'dockerfileAnalysis', data: {} },
              ],
              identity: {
                type: 'deb',
              },
              target: {
                image: 'docker-image|ubuntu',
              },
            },
          ],
        },
        t,
      );

      await params.cli.test('foo:latest', {
        docker: true,
        org: 'explicit-org',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dependencies', 'posts to correct url');
      t.deepEqual(
        req.body,
        {
          scanResult: {
            facts: [
              { type: 'depGraph', data: {} },
              { type: 'dockerfileAnalysis', data: {} },
            ],
            identity: {
              type: 'deb',
            },
            target: {
              image: 'docker-image|ubuntu',
            },
          },
        },
        'sends correct payload',
      );
      t.same(
        spyPlugin.getCall(0).args,
        [
          {
            docker: true,
            org: 'explicit-org',
            projectName: null,
            packageManager: null,
            path: 'foo:latest',
            showVulnPaths: 'some',
          },
        ],
        'calls docker plugin with expected arguments',
      );
      const policyString = req.body.scanResult.policy;
      t.false(policyString, 'policy not sent');
    },

    '`test foo:latest --docker` supports custom policy': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const policyString = fs.readFileSync(
        path.join('npm-package-policy/custom-location', '.snyk'),
        'utf8',
      );
      const spyPlugin = stubDockerPluginResponse(
        params.ecoSystemPlugins,
        {
          scanResults: [
            {
              facts: [
                { type: 'depGraph', data: {} },
                { type: 'dockerfileAnalysis', data: {} },
              ],
              identity: {
                type: 'deb',
              },
              target: {
                image: 'docker-image|ubuntu',
              },
              policy: policyString,
            },
          ],
        },
        t,
      );

      await params.cli.test('foo:latest', {
        docker: true,
        org: 'explicit-org',
        'policy-path': 'npm-package-policy/custom-location',
      });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dependencies', 'posts to correct url');
      t.deepEqual(
        req.body,
        {
          scanResult: {
            facts: [
              { type: 'depGraph', data: {} },
              { type: 'dockerfileAnalysis', data: {} },
            ],
            identity: {
              type: 'deb',
            },
            target: {
              image: 'docker-image|ubuntu',
            },
            policy: policyString,
          },
        },
        'sends correct payload',
      );
      t.same(
        spyPlugin.getCall(0).args,
        [
          {
            docker: true,
            org: 'explicit-org',
            projectName: null,
            packageManager: null,
            path: 'foo:latest',
            showVulnPaths: 'some',
            'policy-path': 'npm-package-policy/custom-location',
          },
        ],
        'calls docker plugin with expected arguments',
      );
    },

    '`test foo:latest --docker with binaries`': (params) => async (t) => {
      const spyPlugin = stubDockerPluginResponse(
        params.ecoSystemPlugins,
        {
          scanResults: [
            {
              facts: [
                { type: 'depGraph', data: {} },
                { type: 'dockerfileAnalysis', data: {} },
                {
                  type: 'keyBinariesHashes',
                  data: [
                    '9191fbcdcc737314df97c5016a841199b743ac3fa9959dfade38e17bfdaf30b5',
                  ],
                },
              ],
              identity: {
                type: 'deb',
              },
              target: {
                image: 'docker-image|ubuntu',
              },
            },
          ],
        },
        t,
      );

      await params.cli.test('foo:latest', {
        docker: true,
        org: 'explicit-org',
      });
      const req = params.server.popRequest();
      t.equal(req.method, 'POST', 'makes POST request');
      t.equal(
        req.headers['x-snyk-cli-version'],
        params.versionNumber,
        'sends version number',
      );
      t.match(req.url, '/test-dependencies', 'posts to correct url');
      t.deepEqual(
        req.body,
        {
          scanResult: {
            facts: [
              { type: 'depGraph', data: {} },
              { type: 'dockerfileAnalysis', data: {} },
              {
                type: 'keyBinariesHashes',
                data: [
                  '9191fbcdcc737314df97c5016a841199b743ac3fa9959dfade38e17bfdaf30b5',
                ],
              },
            ],
            identity: {
              type: 'deb',
            },
            target: {
              image: 'docker-image|ubuntu',
            },
          },
        },
        'sends correct payload',
      );
      t.same(
        spyPlugin.getCall(0).args,
        [
          {
            docker: true,
            org: 'explicit-org',
            projectName: null,
            packageManager: null,
            path: 'foo:latest',
            showVulnPaths: 'some',
          },
        ],
        'calls docker plugin with expected arguments',
      );
    },

    '`test foo:latest --docker with binaries vulnerabilities`': (
      params,
    ) => async (t) => {
      stubDockerPluginResponse(
        params.ecoSystemPlugins,
        {
          scanResults: [
            {
              facts: [
                { type: 'depGraph', data: {} },
                { type: 'dockerfileAnalysis', data: {} },
                {
                  type: 'keyBinariesHashes',
                  data: [
                    '9191fbcdcc737314df97c5016a841199b743ac3fa9959dfade38e17bfdaf30b5',
                  ],
                },
              ],
              identity: {
                type: 'deb',
              },
              target: {
                image: 'docker-image|ubuntu',
              },
            },
          ],
        },
        t,
      );

      const vulns = require('../fixtures/docker/find-result-binaries.json');
      params.server.setNextResponse(vulns);

      try {
        await params.cli.test('foo:latest', {
          docker: true,
          org: 'explicit-org',
        });
        t.fail('should have found vuln');
      } catch (err) {
        const msg = err.message;
        t.match(
          msg,
          'Tested 3 dependencies for known vulnerabilities, found 3 vulnerabilities',
        );
        t.match(msg, 'From: bzip2/libbz2-1.0@1.0.6-8.1');
        t.match(
          msg,
          'From: apt/libapt-pkg5.0@1.6.3ubuntu0.1 > bzip2/libbz2-1.0@1.0.6-8.1',
        );
        t.match(
          msg,
          'Info: http://localhost:12345/vuln/SNYK-UPSTREAM-NODE-72359',
        );
        t.false(
          msg.includes('vulnerable paths'),
          'docker should not includes number of vulnerable paths',
        );
        t.match(msg, 'Detected 2 vulnerabilities for node@5.10.1');
        t.match(msg, 'High severity vulnerability found in node');
        t.match(msg, 'Fixed in: 5.13.1');
        t.match(msg, 'Fixed in: 5.15.1');
      }
    },

    '`test foo:latest --docker with dockerfile instructions`': (
      params,
    ) => async (t) => {
      stubDockerPluginResponse(
        params.ecoSystemPlugins,
        {
          scanResults: [
            {
              facts: [
                { type: 'depGraph', data: {} },
                {
                  type: 'dockerfileAnalysis',
                  data: {
                    dockerfilePackages: {
                      bzip2: {
                        instruction: 'RUN test instruction',
                      },
                    },
                  },
                },
              ],
              identity: {
                type: 'deb',
              },
              target: {
                image: 'docker-image|ubuntu',
              },
            },
          ],
        },
        t,
      );

      const vulns = require('../fixtures/docker/find-result-remediation.json');
      params.server.setNextResponse(vulns);

      try {
        await params.cli.test('foo:latest', {
          docker: true,
          org: 'explicit-org',
        });
        t.fail('should have found vuln');
      } catch (err) {
        const msg = err.message;
        t.match(msg, "Image layer: 'RUN test instruction'");
      }
    },

    '`test foo:latest --docker with auto detected instructions`': (
      params,
    ) => async (t) => {
      stubDockerPluginResponse(
        params.ecoSystemPlugins,
        {
          scanResults: [
            {
              facts: [
                { type: 'depGraph', data: {} },
                {
                  type: 'autoDetectedUserInstructions',
                  data: {
                    dockerfilePackages: {
                      bzip2: {
                        instruction: 'RUN test instruction',
                      },
                    },
                  },
                },
              ],
              identity: {
                type: 'deb',
              },
              target: {
                image: 'docker-image|ubuntu',
              },
            },
          ],
        },
        t,
      );

      const vulns = require('../fixtures/docker/find-result-remediation.json');
      params.server.setNextResponse(vulns);

      try {
        await params.cli.test('foo:latest', {
          docker: true,
          org: 'explicit-org',
        });
        t.fail('should have found vuln');
      } catch (err) {
        const msg = err.message;
        t.match(msg, "Image layer: 'RUN test instruction'");
      }
    },

    '`test --docker --file=Dockerfile --sarif `': (params, utils) => async (
      t,
    ) => {
      const testableObject = await testSarif(t, utils, params, { sarif: true });
      const results = JSON.parse(testableObject.message);
      const sarifResults = require('../fixtures/docker/sarif-container-result.json');
      t.deepEqual(results, sarifResults, 'stdout containing sarif results');
      t.end();
    },

    '`test --docker --file=Dockerfile --sarif --sarif-output-file`': (
      params,
      utils,
    ) => async (t) => {
      const testableObject = await testSarif(t, utils, params, {
        sarif: true,
        'sarif-output-file': 'sarif-test-file.json',
      });
      const results = JSON.parse(testableObject.message);
      const sarifStringifiedResults = JSON.parse(
        testableObject.sarifStringifiedResults,
      );
      t.deepEqual(
        results,
        sarifStringifiedResults,
        'stdout and stringified sarif results are the same',
      );
      t.end();
    },

    '`test --docker doesnotexist`': (params) => async (t) => {
      try {
        await params.cli.test('doesnotexist', {
          docker: true,
          org: 'explicit-org',
        });
        t.fail('should have thrown');
      } catch (err) {
        const msg = err.message;
        t.match(
          msg,
          'Failed to scan image "doesnotexist". Please make sure the image and/or repository exist, and that you are using the correct credentials.',
        );
      }
    },
  },
};

// fixture can be fixture path or object
function stubDockerPluginResponse(plugins, fixture: string | object, t) {
  const plugin = {
    async scan(_) {
      return typeof fixture === 'object' ? fixture : require(fixture);
    },
    async display() {
      return '';
    },
  };
  const spyPlugin = sinon.spy(plugin, 'scan');
  const loadPlugin = sinon.stub(plugins, 'getPlugin');
  loadPlugin.withArgs(sinon.match.any).returns(plugin);
  t.teardown(loadPlugin.restore);

  return spyPlugin;
}

async function testSarif(t, utils, params, flags) {
  stubDockerPluginResponse(
    params.ecoSystemPlugins,
    {
      scanResults: [
        {
          facts: [
            { type: 'depGraph', data: {} },
            { type: 'dockerfileAnalysis', data: {} },
            {
              type: 'keyBinariesHashes',
              data: [
                '9191fbcdcc737314df97c5016a841199b743ac3fa9959dfade38e17bfdaf30b5',
              ],
            },
          ],
          identity: {
            type: 'deb',
          },
          target: {
            image: 'docker-image|ubuntu',
          },
        },
      ],
    },
    t,
  );

  const testableObject = await testPrep(t, utils, params, flags);
  return testableObject;
}

async function testPrep(t, utils, params, additionaLpropsForCli) {
  utils.chdirWorkspaces();
  const vulns = require('../fixtures/docker/find-result.json');
  params.server.setNextResponse(vulns);

  try {
    await params.cli.test('test alpine', {
      docker: true,
      ...additionaLpropsForCli,
    });
    t.fail('should have thrown');
  } catch (testableObject) {
    return testableObject;
  }
}
