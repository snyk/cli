import * as sinon from 'sinon';
import * as fs from 'fs';
import * as path from 'path';

import { AcceptanceTests } from './cli-test.acceptance.test';

export const DockerTests: AcceptanceTests = {
  language: 'Docker',
  tests: {
    '`test foo:latest --docker`': (params) => async (t) => {
      const spyPlugin = stubDockerPluginResponse(
        params.plugins,
        {
          plugin: {
            packageManager: 'deb',
          },
          package: {},
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
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'deb');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'foo:latest',
          null,
          {
            args: null,
            file: null,
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
        params.plugins,
        {
          plugin: {
            packageManager: 'deb',
          },
          package: {
            name: 'docker-image',
            dependencies: {
              'apt/libapt-pkg5.0': {
                version: '1.6.3ubuntu0.1',
                dependencies: {
                  'bzip2/libbz2-1.0': {
                    version: '1.0.6-8.1',
                  },
                },
              },
              'bzip2/libbz2-1.0': {
                version: '1.0.6-8.1',
              },
            },
          },
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
        params.plugins,
        {
          plugin: {
            packageManager: 'deb',
          },
          package: {
            docker: {
              baseImage: 'ubuntu:14.04',
            },
          },
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
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'deb');
      t.equal(
        req.body.docker.baseImage,
        'ubuntu:14.04',
        'posts docker baseImage',
      );
      t.same(
        spyPlugin.getCall(0).args,
        [
          'foo:latest',
          'Dockerfile',
          {
            args: null,
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
        params.plugins,
        '../fixtures/docker/plugin-multiple-deps',
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
        params.plugins,
        {
          plugin: {
            packageManager: 'deb',
          },
          package: {},
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
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'deb');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'foo:latest',
          null,
          {
            args: null,
            file: null,
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
      const policyString = req.body.policy;
      t.false(policyString, 'policy not sent');
    },

    '`test foo:latest --docker` supports custom policy': (
      params,
      utils,
    ) => async (t) => {
      utils.chdirWorkspaces();
      const spyPlugin = stubDockerPluginResponse(
        params.plugins,
        {
          plugin: {
            packageManager: 'deb',
          },
          package: {},
        },
        t,
      );

      await params.cli.test('foo:latest', {
        docker: true,
        org: 'explicit-org',
        'policy-path': 'npm-package-policy/custom-location',
      });
      const req = params.server.popRequest();
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'deb');
      t.same(
        spyPlugin.getCall(0).args,
        [
          'foo:latest',
          null,
          {
            args: null,
            file: null,
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

      const expected = fs.readFileSync(
        path.join('npm-package-policy/custom-location', '.snyk'),
        'utf8',
      );
      const policyString = req.body.policy;
      t.equal(policyString, expected, 'sends correct policy');
    },

    '`test foo:latest --docker with binaries`': (params) => async (t) => {
      const spyPlugin = stubDockerPluginResponse(
        params.plugins,
        {
          plugin: {
            packageManager: 'deb',
          },
          package: {
            docker: {
              binaries: [{ name: 'node', version: '5.10.1' }],
            },
          },
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
      t.match(req.url, '/test-dep-graph', 'posts to correct url');
      t.equal(req.body.depGraph.pkgManager.name, 'deb');
      t.same(
        req.body.docker.binaries,
        [{ name: 'node', version: '5.10.1' }],
        'posts docker binaries',
      );
      t.same(
        spyPlugin.getCall(0).args,
        [
          'foo:latest',
          null,
          {
            args: null,
            file: null,
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
        params.plugins,
        {
          plugin: {
            packageManager: 'deb',
          },
          package: {
            name: 'docker-image',
            dependencies: {
              'apt/libapt-pkg5.0': {
                version: '1.6.3ubuntu0.1',
                dependencies: {
                  'bzip2/libbz2-1.0': {
                    version: '1.0.6-8.1',
                  },
                },
              },
              'bzip2/libbz2-1.0': {
                version: '1.0.6-8.1',
              },
              'bzr/libbz2-1.0': {
                version: '1.0.6-8.1',
              },
            },
            docker: {
              binaries: {
                Analysis: [{ name: 'node', version: '5.10.1' }],
              },
            },
          },
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
  },
};

// fixture can be fixture path or object
function stubDockerPluginResponse(plugins, fixture: string | object, t) {
  const plugin = {
    async inspect() {
      return typeof fixture === 'object' ? fixture : require(fixture);
    },
  };
  const spyPlugin = sinon.spy(plugin, 'inspect');
  const loadPlugin = sinon.stub(plugins, 'loadPlugin');
  loadPlugin
    .withArgs(sinon.match.any, sinon.match({ docker: true }))
    .returns(plugin);
  t.teardown(loadPlugin.restore);

  return spyPlugin;
}
