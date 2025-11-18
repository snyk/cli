import { AcceptanceTests } from '../cli-test.acceptance.test';

export const DockerDHITests: AcceptanceTests = {
  language: 'Docker',
  tests: {
    '`test foo:latest --docker` with mixed DHI and non-DHI packages':
      (params) => async (t) => {
        const spyPlugin = stubDockerPluginResponse(
          params.ecoSystemPlugins,
          {
            scanResults: [
              {
                facts: [
                  {
                    type: 'depGraph',
                    data: {
                      schemaVersion: '1.2.0',
                      pkgManager: {
                        name: 'deb',
                        repositories: [{ alias: 'debian:12' }],
                      },
                      pkgs: [
                        {
                          id: 'docker-image|foo@latest',
                          info: {
                            name: 'docker-image|foo',
                            version: 'latest',
                          },
                        },
                        {
                          id: 'curl@7.88.1-10+deb12u8',
                          info: {
                            name: 'curl',
                            version: '7.88.1-10+deb12u8',
                            purl: 'pkg:deb/dhi/curl@7.88.1-10%2Bdeb12u8?distro=debian-bookworm',
                          },
                        },
                        {
                          id: 'base-files@12.4+deb12u5',
                          info: {
                            name: 'base-files',
                            version: '12.4+deb12u5',
                            purl: 'pkg:deb/debian/base-files@12.4%2Bdeb12u5?distro=debian-bookworm',
                          },
                        },
                      ],
                      graph: {
                        rootNodeId: 'root-node',
                        nodes: [
                          {
                            nodeId: 'root-node',
                            pkgId: 'docker-image|foo@latest',
                            deps: [
                              { nodeId: 'curl@7.88.1-10+deb12u8' },
                              { nodeId: 'base-files@12.4+deb12u5' },
                            ],
                          },
                          {
                            nodeId: 'curl@7.88.1-10+deb12u8',
                            pkgId: 'curl@7.88.1-10+deb12u8',
                            deps: [],
                          },
                          {
                            nodeId: 'base-files@12.4+deb12u5',
                            pkgId: 'base-files@12.4+deb12u5',
                            deps: [],
                          },
                        ],
                      },
                    },
                  },
                  { type: 'dockerfileAnalysis', data: {} },
                ],
                identity: {
                  type: 'deb',
                },
                target: {
                  image: 'docker-image|foo',
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
        t.match(req.url, '/test-dependencies', 'posts to correct url');

        const depGraphData = req.body.scanResult.facts.find(
          (fact) => fact.type === 'depGraph',
        )?.data;
        t.ok(depGraphData, 'depGraph fact exists');

        const curlPkg = depGraphData.pkgs.find(
          (pkg) => pkg.id === 'curl@7.88.1-10+deb12u8',
        );
        t.ok(curlPkg, 'curl package exists in depGraph');
        t.equal(
          curlPkg?.info?.purl,
          'pkg:deb/dhi/curl@7.88.1-10%2Bdeb12u8?distro=debian-bookworm',
          'DHI package has dhi namespace in PURL',
        );

        const baseFilesPkg = depGraphData.pkgs.find(
          (pkg) => pkg.id === 'base-files@12.4+deb12u5',
        );
        t.ok(baseFilesPkg, 'base-files package exists in depGraph');
        t.equal(
          baseFilesPkg?.info?.purl,
          'pkg:deb/debian/base-files@12.4%2Bdeb12u5?distro=debian-bookworm',
          'non-DHI package has debian namespace in PURL',
        );

        t.same(
          spyPlugin.getCall(0).args,
          [
            {
              docker: true,
              org: 'explicit-org',
              showVulnPaths: 'some',
              maxVulnPaths: undefined,
              'exclude-app-vulns': false,
              path: 'foo:latest',
              projectName: undefined,
              packageManager: undefined,
            },
          ],
          'calls docker plugin with expected arguments',
        );
      },
  },
};

function stubDockerPluginResponse(plugins, fixture: string | object, t) {
  const plugin = {
    async scan() {
      return typeof fixture === 'object' ? fixture : await import(fixture);
    },
    async display() {
      return '';
    },
  };
  const spyPlugin = require('sinon').spy(plugin, 'scan');
  const loadPlugin = require('sinon').stub(plugins, 'getPlugin');
  loadPlugin.withArgs(require('sinon').match.any).returns(plugin);
  t.teardown(loadPlugin.restore);

  return spyPlugin;
}
