import * as os from 'os';
import { startSnykCLI, TestCLI } from '../../util/startSnykCLI';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('snyk container', () => {
  if (os.platform() === 'win32') {
    // eslint-disable-next-line jest/no-focused-tests
    it.only('Windows not yet supported', () => {
      console.warn(
        "Skipping as we don't have a Windows-compatible image to test against.",
      );
    });
  }

  let cli: TestCLI | null = null;

  afterEach(async () => {
    if (cli) {
      await cli.stop();
      cli = null;
    }
  });

  it('finds dependencies in rpm sqlite databases', async () => {
    cli = await startSnykCLI(
      'container test amazonlinux:2022.0.20220504.1 --print-deps',
    );
    await expect(cli).toDisplay(`yum @ 4.9.0`, { timeout: 60 * 1000 });
  });

  it('finds dependencies in oci image (library/ubuntu)', async () => {
    cli = await startSnykCLI(
      'container test library/ubuntu@sha256:7a57c69fe1e9d5b97c5fe649849e79f2cfc3bf11d10bbd5218b4eb61716aebe6 --print-deps',
    );
    await expect(cli).toDisplay(`coreutils @ 8.32-4.1ubuntu1`, {
      timeout: 60 * 1000,
    });
  });
  it('prints dep graph with --print-graph flag', async () => {
    const { code, stdout } = await runSnykCLI(
      'container test --print-graph gcr.io/distroless/static@sha256:7198a357ff3a8ef750b041324873960cf2153c11cc50abb9d8d5f8bb089f6b4e',
    );

    expect(code).toBe(0);
    expect(stdout).toContain('DepGraph data:');
    expect(stdout).toContain(
      `DepGraph target:
docker-image|gcr.io/distroless/static
DepGraph end`,
    );
    const jsonDGStr = stdout
      .split('DepGraph data:')[1]
      .split('DepGraph target:')[0];
    const jsonDG = JSON.parse(jsonDGStr);
    expect(jsonDG).toMatchObject({
      schemaVersion: '1.3.0',
      pkgManager: {
        name: 'deb',
        repositories: [
          {
            alias: 'debian:11',
          },
        ],
      },
      pkgs: [
        {
          id: 'docker-image|gcr.io/distroless/static@',
          info: {
            name: 'docker-image|gcr.io/distroless/static',
          },
        },
        {
          id: 'base-files@11.1+deb11u7',
          info: {
            name: 'base-files',
            version: '11.1+deb11u7',
          },
        },
        {
          id: 'netbase@6.3',
          info: {
            name: 'netbase',
            version: '6.3',
          },
        },
        {
          id: 'tzdata@2021a-1+deb11u10',
          info: {
            name: 'tzdata',
            version: '2021a-1+deb11u10',
          },
        },
      ],
      graph: {
        rootNodeId: 'root-node',
        nodes: [
          {
            nodeId: 'root-node',
            pkgId: 'docker-image|gcr.io/distroless/static@',
            deps: [
              {
                nodeId: 'base-files@11.1+deb11u7',
              },
              {
                nodeId: 'netbase@6.3',
              },
              {
                nodeId: 'tzdata@2021a-1+deb11u10',
              },
            ],
          },
          {
            nodeId: 'base-files@11.1+deb11u7',
            pkgId: 'base-files@11.1+deb11u7',
            deps: [],
          },
          {
            nodeId: 'netbase@6.3',
            pkgId: 'netbase@6.3',
            deps: [],
          },
          {
            nodeId: 'tzdata@2021a-1+deb11u10',
            pkgId: 'tzdata@2021a-1+deb11u10',
            deps: [],
          },
        ],
      },
    });
  });
});
