import { fakeServer } from '../../acceptance/fake-server';
import * as fs from 'fs';
import { createProjectFromWorkspace } from '../util/createProject';
import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('test --json-file-output', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll((done) => {
    const apiPath = '/api/v1';
    const apiPort = process.env.PORT || process.env.SNYK_PORT || '12345';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + apiPort + apiPath,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };

    server = fakeServer(apiPath, env.SNYK_TOKEN);
    server.listen(apiPort, () => done());
  });

  afterEach(() => {
    server.restore();
  });

  afterAll((done) => {
    server.close(() => done());
  });

  it('test with --json returns without error and with JSON return type when no vulns found', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    server.setDepGraphResponse(await project.readJSON('vulns-result.json'));

    const { code, stdout } = await runSnykCLI(`test --json`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    const outputObj = JSON.parse(stdout);
    expect(outputObj).not.toBe('');
  });

  it('test without --json returns without error and with a string return type when no vulns found', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-vulns');
    server.setDepGraphResponse(await project.readJSON('vulns-result.json'));

    const { code, stdout } = await runSnykCLI(`test`, {
      cwd: project.path(),
      env,
    });

    expect(code).toEqual(0);

    expect(server.getRequests().length).toBeGreaterThanOrEqual(1);
    expect(stdout).not.toBe('');
    expect(typeof stdout).toBe('string');
  });

  it('test with --json throws error and error contains json output with vulnerabilities when vulns found', async () => {
    const project = await createProjectFromWorkspace('fail-on/no-fixable');
    server.setDepGraphResponse(await project.readJSON('vulns-result.json'));

    const { code, stdout } = await runSnykCLI(`test --json`, {
      cwd: project.path(),
      env,
    });

    const returnedJson = JSON.parse(stdout);
    expect(returnedJson.vulnerabilities.length > 0).toBeTruthy();
    expect(code).toEqual(1);
    expect(stdout).not.toBe('');
  });

  it('can save JSON output to file while sending human readable output to stdout', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    const outputPath = 'json-file-output.json';

    const { code, stdout } = await runSnykCLI(
      `test --json-file-output=${outputPath}`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(stdout).toMatch('Organization:');
    expect(await project.readJSON(outputPath)).toMatchObject({ ok: true });
  });

  it('test --json-file-output produces same JSON output as normal JSON output to stdout', async () => {
    const project = await createProjectFromWorkspace('no-vulns');
    const outputPath = 'json-file-output.json';

    const { code, stdout } = await runSnykCLI(
      `test --json --json-file-output=${outputPath}`,
      {
        cwd: project.path(),
        env,
      },
    );

    expect(code).toEqual(0);
    expect(await project.read(outputPath)).toEqual(stdout);
  });

  // skip for now, this will break fake-server
  it.skip('test --json-file-ouput handles responses larger than 512Mb limit in v8', async () => {
    const project = await createProjectFromWorkspace(
      'extra-large-response-payload',
    );
    const outputFilename = 'json-file-output.json';
    const response = await project.readJSON('vulns-result.json');
    response.result.issuesData['SNYK-JS-YARN-451572'] = {
      CVSSv3: 'CVSS:3.0/AV:N/AC:H/PR:N/UI:R/S:C/C:H/I:L/A:H/E:P/RL:O/RC:C',
      alternativeIds: [],
      creationTime: '2019-07-15T09:33:20.212098Z',
      credit: ['Сковорода Никита Андреевич'],
      cvssScore: 8.2,
      description:
        '## Overview\n\n[yarn](https://yarnpkg.com/) is a Fast, reliable, and secure dependency management.\n\n\nAffected versions of this package are vulnerable to Man-in-the-Middle (MitM).\nNpm credentials such as `_authToken` were found to be sent over clear text when processing scoped packages that are listed as resolved. This could allow a suitably positioned attacker to eavesdrop and compromise the sent credentials.\n\n## Remediation\n\nUpgrade `yarn` to version 1.17.3 or higher.\n\n\n## References\n\n- [Blog - Yarn transferred npm credentials over Unencrypted HTTP Connection](https://github.com/ChALkeR/notes/blob/master/Yarn-vuln.md)\n\n- [GitHub Commit](https://github.com/yarnpkg/yarn/commit/2f08a7405cc3f6fe47c30293050bb0ac94850932)\n\n- [HackerOne Report](https://hackerone.com/reports/640904)\n',
      disclosureTime: '2019-07-12T09:30:13Z',
      exploit: 'Proof of Concept',
      fixedIn: ['1.17.3'],
      functions: [],
      functions_new: [],
      id: 'SNYK-JS-YARN-451571',
      identifiers: { CVE: ['CVE-2019-5448'], CWE: ['CWE-300'] },
      language: 'js',
      modificationTime: '2019-07-15T15:25:40.382392Z',
      moduleName: 'yarn',
      packageManager: 'npm',
      packageName: 'yarn',
      patches: [],
      publicationTime: '2019-07-15T09:29:56Z',
      references: [
        {
          title:
            'Blog - Yarn transferred npm credentials over Unencrypted HTTP Connection',
          url: 'https://github.com/ChALkeR/notes/blob/master/Yarn-vuln.md',
        },
        {
          title: 'GitHub Commit',
          url:
            'https://github.com/yarnpkg/yarn/commit/2f08a7405cc3f6fe47c30293050bb0ac94850932',
        },
        {
          title: 'HackerOne Report',
          url: 'https://hackerone.com/reports/640904',
        },
      ],
      semver: { vulnerable: ['<1.17.3'] },
      severity: 'high',
      title: 'Man-in-the-Middle (MitM)',
      isPinnable: false,
      bigArray: new Array(270 * 1024).fill({
        CVSSv3: 'CVSS:3.0/AV:N/AC:H/PR:N/UI:R/S:C/C:H/I:L/A:H/E:P/RL:O/RC:C',
        alternativeIds: [],
        creationTime: '2019-07-15T09:33:20.212098Z',
        credit: ['Сковорода Никита Андреевич'],
        cvssScore: 8.2,
        description:
          '## Overview\n\n[yarn](https://yarnpkg.com/) is a Fast, reliable, and secure dependency management.\n\n\nAffected versions of this package are vulnerable to Man-in-the-Middle (MitM).\nNpm credentials such as `_authToken` were found to be sent over clear text when processing scoped packages that are listed as resolved. This could allow a suitably positioned attacker to eavesdrop and compromise the sent credentials.\n\n## Remediation\n\nUpgrade `yarn` to version 1.17.3 or higher.\n\n\n## References\n\n- [Blog - Yarn transferred npm credentials over Unencrypted HTTP Connection](https://github.com/ChALkeR/notes/blob/master/Yarn-vuln.md)\n\n- [GitHub Commit](https://github.com/yarnpkg/yarn/commit/2f08a7405cc3f6fe47c30293050bb0ac94850932)\n\n- [HackerOne Report](https://hackerone.com/reports/640904)\n',
        disclosureTime: '2019-07-12T09:30:13Z',
        exploit: 'Proof of Concept',
        fixedIn: ['1.17.3'],
        functions: [],
        functions_new: [],
        id: 'SNYK-JS-YARN-451571',
        identifiers: { CVE: ['CVE-2019-5448'], CWE: ['CWE-300'] },
        language: 'js',
        modificationTime: '2019-07-15T15:25:40.382392Z',
        moduleName: 'yarn',
        packageManager: 'npm',
        packageName: 'yarn',
        patches: [],
        publicationTime: '2019-07-15T09:29:56Z',
        references: [
          {
            title:
              'Blog - Yarn transferred npm credentials over Unencrypted HTTP Connection',
            url: 'https://github.com/ChALkeR/notes/blob/master/Yarn-vuln.md',
          },
          {
            title: 'GitHub Commit',
            url:
              'https://github.com/yarnpkg/yarn/commit/2f08a7405cc3f6fe47c30293050bb0ac94850932',
          },
          {
            title: 'HackerOne Report',
            url: 'https://hackerone.com/reports/640904',
          },
        ],
        semver: { vulnerable: ['<1.17.3'] },
        severity: 'high',
        title: 'Man-in-the-Middle (MitM)',
        isPinnable: false,
      }),
      biggerArray: new Array(1 * 1024 * 1024).fill({
        sample: 'foo',
      }),
    };
    server.setDepGraphResponse(response);

    const { code, stderr } = await runSnykCLI(
      `test --json-file-output=${outputFilename}`,
      {
        cwd: project.path(),
        env,
      },
    );

    console.log({ stderr });
    const outputPath = await project.path(outputFilename);
    expect(code).toEqual(1);
    console.log({
      outputPath,
      outputPathSize: humanFileSize(fs.statSync(outputPath).size),
    });
    expect(fs.statSync(outputPath).size).toBeGreaterThan(0); // >50MB
  });
});

/**
 * Format bytes as human-readable text.
 *
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 *
 * @return Formatted string.
 */
function humanFileSize(bytes, si = false, dp = 1) {
  const thresh = si ? 1000 : 1024;

  if (Math.abs(bytes) < thresh) {
    return bytes + ' B';
  }

  const units = si
    ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
    : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
  let u = -1;
  const r = 10 ** dp;

  do {
    bytes /= thresh;
    ++u;
  } while (
    Math.round(Math.abs(bytes) * r) / r >= thresh &&
    u < units.length - 1
  );

  return bytes.toFixed(dp) + ' ' + units[u];
}
