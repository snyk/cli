import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('log4shell command', () => {
  let env: Record<string, string>;

  beforeAll(() => {
    env = {
      ...process.env,
      SNYK_DISABLE_ANALYTICS: '1',
    };
  });

  it('detects vulnerable versions of log4j only in jar files', async () => {
    const project = await createProjectFromFixture(
      'unmanaged-log4j-fixture/vulnerable',
    );

    const { code, stdout } = await runSnykCLI('log4shell', {
      cwd: project.path(),
      env,
    });

    const expected = `Please note this command is for already built artifacts. To test source code please use \`snyk test\`.
- Looking for Log4Shell...

Results:
A version of Log4J that is vulnerable to Log4Shell was detected:
\t./log4j-core-2.12.0.jar
\t./log4j-core-2.12.1.jar
\t./log4j-core-2.13.0.jar
\t./log4j-core-2.13.1.jar
\t./log4j-core-2.13.2.jar
\t./log4j-core-2.13.3.jar
\t./log4j-core-2.14.0.jar
\t./log4j-core-2.14.1.jar
\t./log4j-core-2.15.0.jar

We highly recommend fixing this vulnerability. If it cannot be fixed by upgrading, see mitigation information here:
      \t- https://security.snyk.io/vuln/SNYK-JAVA-ORGAPACHELOGGINGLOG4J-2314720
      \t- https://snyk.io/blog/log4shell-remediation-cheat-sheet/

A version of Log4J that is vulnerable to CVE-2021-45105 (Denial of Service) was detected:
\t./log4j-core-2.16.0.jar

We recommend fixing this vulnerability by upgrading to a later version. To learn more about this vulnerability, see:
      \t- https://security.snyk.io/vuln/SNYK-JAVA-ORGAPACHELOGGINGLOG4J-2321524


`;

    expect(code).toBe(1);
    expect(stdout).toContain(expected);
  });

  it('detects vulnerable versions of log4j for mixed file extensions (jar, ear) and nested files', async () => {
    const project = await createProjectFromFixture(
      'unmanaged-log4j-fixture/vulnerable-mixed-extensions',
    );

    const { code, stdout } = await runSnykCLI('log4shell', {
      cwd: project.path(),
      env,
    });

    const expected = `Please note this command is for already built artifacts. To test source code please use \`snyk test\`.
- Looking for Log4Shell...

Results:
A version of Log4J that is vulnerable to Log4Shell was detected:
\t./log4j-core-2.13.0.jar
\t./nested-artifacts/snyk-module.ear/log4j-core-2.14.0.jar
\t./nested-artifacts/snyk-module.jar/log4j-core-2.14.1.jar
\t./snyk-module.ear/log4j-core-2.14.0.jar

We highly recommend fixing this vulnerability. If it cannot be fixed by upgrading, see mitigation information here:
      \t- https://security.snyk.io/vuln/SNYK-JAVA-ORGAPACHELOGGINGLOG4J-2314720
      \t- https://snyk.io/blog/log4shell-remediation-cheat-sheet/


`;

    expect(code).toBe(1);
    expect(stdout).toContain(expected);
  });

  it('not detects non-vulnerable versions of log4j', async () => {
    const project = await createProjectFromFixture(
      'unmanaged-log4j-fixture/not-vulnerable',
    );

    const { code, stdout } = await runSnykCLI('log4shell', {
      cwd: project.path(),
      env,
    });

    const expected = `Please note this command is for already built artifacts. To test source code please use \`snyk test\`.
- Looking for Log4Shell...

Results:
No known vulnerable version of Log4J was detected
`;

    expect(code).toBe(0);
    expect(stdout).toContain(expected);
  });

  it('detects vulnerable versions of nested log4j jar', async () => {
    const project = await createProjectFromFixture(
      'unmanaged-log4j-fixture/vulnerable-nested',
    );

    const { code, stdout } = await runSnykCLI('log4shell', {
      cwd: project.path(),
      env,
    });

    const expected = `Please note this command is for already built artifacts. To test source code please use \`snyk test\`.
- Looking for Log4Shell...

Results:
A version of Log4J that is vulnerable to Log4Shell was detected:
\t./1-level/1-level-nested.jar/log4j-core-2.14.1.jar
\t./2-level/2-level-nested.jar/libs/1-level-nested.jar/log4j-core-2.14.1.jar
\t./3-level/3-level-nested.jar/libs/2-level-nested.jar/libs/1-level-nested.jar/log4j-core-2.14.1.jar
\t./4-level/4-level-nested.jar/libs/3-level-nested.jar/libs/2-level-nested.jar/libs/1-level-nested.jar/log4j-core-2.14.1.jar
\t./5-level/5-level-nested.jar/libs/4-level-nested.jar/libs/3-level-nested.jar/libs/2-level-nested.jar/libs/1-level-nested.jar/log4j-core-2.14.1.jar

We highly recommend fixing this vulnerability. If it cannot be fixed by upgrading, see mitigation information here:
      \t- https://security.snyk.io/vuln/SNYK-JAVA-ORGAPACHELOGGINGLOG4J-2314720
      \t- https://snyk.io/blog/log4shell-remediation-cheat-sheet/


`;

    expect(code).toBe(1);
    expect(stdout).toContain(expected);
  });

  it('detects vulnerable versions of log4j without jar', async () => {
    const project = await createProjectFromFixture(
      'unmanaged-log4j-fixture/no-jar',
    );

    const { code, stdout } = await runSnykCLI('log4shell', {
      cwd: project.path(),
      env,
    });

    const expected = `Please note this command is for already built artifacts. To test source code please use \`snyk test\`.
- Looking for Log4Shell...

Results:
A version of Log4J that is vulnerable to Log4Shell was detected:
\t./org/apache/logging/log4j/core

We highly recommend fixing this vulnerability. If it cannot be fixed by upgrading, see mitigation information here:
      \t- https://security.snyk.io/vuln/SNYK-JAVA-ORGAPACHELOGGINGLOG4J-2314720
      \t- https://snyk.io/blog/log4shell-remediation-cheat-sheet/


`;

    expect(code).toBe(1);
    expect(stdout).toContain(expected);
  });

  it('displays DOS message for 2.16.x', async () => {
    const project = await createProjectFromFixture(
      'unmanaged-log4j-fixture/vulnerable-dos',
    );

    const { code, stdout } = await runSnykCLI('log4shell', {
      cwd: project.path(),
      env,
    });

    const expected = `Please note this command is for already built artifacts. To test source code please use \`snyk test\`.
- Looking for Log4Shell...

Results:
A version of Log4J that is vulnerable to CVE-2021-45105 (Denial of Service) was detected:
\t./ear/ear-1.0-SNAPSHOT.ear/log4j-core-2.16.0.jar
\t./log4j-core-2.16.0.jar
\t./war/war-1.0-SNAPSHOT.war/WEB-INF/lib/log4j-core-2.16.0.jar

We recommend fixing this vulnerability by upgrading to a later version. To learn more about this vulnerability, see:
      \t- https://security.snyk.io/vuln/SNYK-JAVA-ORGAPACHELOGGINGLOG4J-2321524


`;

    expect(code).toBe(1);
    expect(stdout).toContain(expected);
  });
});
