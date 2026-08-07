import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { fakeServer } from '../../../acceptance/fake-server';
import { getAvailableServerPort } from '../../util/getServerPort';
import { isWindowsOperatingSystem } from '../../../utils';

jest.setTimeout(1000 * 60 * 5);

// `--include-component-metadata` makes the maven plugin read the install-time
// `.jar.sha1` companion files, and the `_remote.repositories` file Maven
// writes alongside each downloaded artifact, from the local Maven repository.
// These surface as `hash:<algorithm>` and `distribution:url` labels on the
// dep-graph nodes. The artifacts must therefore be resolved into the local
// repository first (via `mvn`), otherwise there are no companion files to
// read.
describe('`snyk test --include-component-metadata` (maven)', () => {
  let server;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = await getAvailableServerPort(process);
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await server.listenPromise(port);
  });

  afterEach(() => {
    jest.resetAllMocks();
    server.restore();
  });

  afterAll(
    () =>
      new Promise((res) => {
        server.close(res);
      }),
  );

  const parseDepGraph = (printGraphStdout: string) =>
    JSON.parse(
      printGraphStdout.split('DepGraph data:')[1].split('DepGraph target:')[0],
    );

  const hashLabelKeys = (printGraphStdout: string): string[] =>
    parseDepGraph(printGraphStdout)
      .graph.nodes.flatMap((node) => Object.keys(node.info?.labels ?? {}))
      .filter((key) => key.startsWith('hash:'));

  const distributionUrlLabels = (printGraphStdout: string): string[] =>
    parseDepGraph(printGraphStdout)
      .graph.nodes.map((node) => node.info?.labels?.['distribution:url'])
      .filter(Boolean);

  // mvn is required to resolve artifacts into the local repository first.
  it('attaches `hash:<algorithm>` and `distribution:url` labels when artifacts are resolved', async () => {
    const project = await createProjectFromFixture('maven-print-graph');

    // Populate the local Maven repository so the `.jar.sha1` companion files
    // and `_remote.repositories` records the plugin reads are present.
    execFileSync('mvn', ['dependency:resolve'], {
      cwd: project.path(),
      stdio: 'ignore',
      shell: isWindowsOperatingSystem(),
    });

    const { code, stdout } = await runSnykCLI(
      'test --include-component-metadata --print-graph',
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(stdout).toContain('DepGraph data:');
    expect(hashLabelKeys(stdout).length).toBeGreaterThan(0);

    // The fixture's axis:axis@1.4 dependency resolves from whichever repository
    // serves Maven Central (a mirror may be configured to avoid rate limits),
    // so assert the artifact path suffix rather than a specific repository host.
    expect(
      distributionUrlLabels(stdout).some((url) =>
        url.endsWith('/axis/axis/1.4/axis-1.4.jar'),
      ),
    ).toBe(true);
  });

  // Control: without the flag the same project must not produce hash or
  // distribution:url labels, proving the labels are driven by
  // `--include-component-metadata`.
  it('does not attach hash or distribution:url labels without the flag', async () => {
    const project = await createProjectFromFixture('maven-print-graph');

    execFileSync('mvn', ['dependency:resolve'], {
      cwd: project.path(),
      stdio: 'ignore',
      shell: isWindowsOperatingSystem(),
    });

    const { code, stdout } = await runSnykCLI('test --print-graph', {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);
    expect(stdout).toContain('DepGraph data:');
    expect(hashLabelKeys(stdout)).toHaveLength(0);
    expect(distributionUrlLabels(stdout)).toHaveLength(0);
  });

  // Regression test: a repository can be configured with basic-auth
  // credentials embedded directly in its URL (e.g.
  // `https://user:secret@example.invalid/maven2`) rather than via a
  // settings.xml <server> block. `mvn dependency:list-repositories` prints
  // that URL verbatim, so those credentials must never end up in the
  // distribution:url label / downstream SBOM externalReferences.
  //
  // The `io.snyk.example:creds-dep` dependency doesn't exist on any real
  // repository, so rather than resolving it for real (which would need a
  // live server that tolerates arbitrary credentials) we hand-construct its
  // local .m2 entry — jar, pom, and the `_remote.repositories` record —
  // exactly what `mvn dependency:resolve` would have written had the
  // artifact actually come from `creds-repo`. `dependency:tree` and
  // `dependency:list-repositories` need nothing beyond the project's own
  // pom.xml and that local cache to succeed, so the whole test runs
  // hermetically, without ever contacting `example.invalid`.
  //
  it('does not leak repository URL credentials into the distribution:url label', async () => {
    const project = await createProjectFromFixture('maven-creds-repo');

    const repoDir = path.join(
      os.homedir(),
      '.m2',
      'repository',
      'io',
      'snyk',
      'example',
      'creds-dep',
      '1.0',
    );
    fs.mkdirSync(repoDir, { recursive: true });
    fs.writeFileSync(
      path.join(repoDir, 'creds-dep-1.0.pom'),
      [
        '<project xmlns="http://maven.apache.org/POM/4.0.0">',
        '  <modelVersion>4.0.0</modelVersion>',
        '  <groupId>io.snyk.example</groupId>',
        '  <artifactId>creds-dep</artifactId>',
        '  <version>1.0</version>',
        '  <packaging>jar</packaging>',
        '</project>',
        '',
      ].join('\n'),
    );
    fs.writeFileSync(
      path.join(repoDir, 'creds-dep-1.0.jar'),
      'fake jar contents',
    );
    fs.writeFileSync(
      path.join(repoDir, '_remote.repositories'),
      '#NOTE: internal Maven Resolver file\n' +
        'creds-dep-1.0.pom>creds-repo=\n' +
        'creds-dep-1.0.jar>creds-repo=\n',
    );

    try {
      const { code, stdout } = await runSnykCLI(
        'test --include-component-metadata --print-graph',
        {
          cwd: project.path(),
          env,
        },
      );

      expect(code).toEqual(0);
      expect(stdout).toContain('DepGraph data:');

      const urls = distributionUrlLabels(stdout);
      expect(
        urls.some((url) =>
          url.endsWith('/io/snyk/example/creds-dep/1.0/creds-dep-1.0.jar'),
        ),
      ).toBe(true);

      // The credentialed repo's URL must appear stripped of its userinfo
      // (`user:secret@`), on every emitted label.
      for (const url of urls) {
        expect(url).not.toContain('user:secret');
        expect(url).not.toMatch(/:\/\/[^/]*@/);
      }
    } finally {
      fs.rmSync(path.dirname(repoDir), { recursive: true, force: true });
    }
  });
});
