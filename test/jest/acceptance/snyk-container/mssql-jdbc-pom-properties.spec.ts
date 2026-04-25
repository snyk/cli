import { runSnykCLI } from '../../util/runSnykCLI';
import { describeIf, isWindowsOperatingSystem } from '../../../utils';

jest.setTimeout(1000 * 60);

/**
 * Tests for CN-1011: Microsoft SQL Server JDBC driver pom.properties fix
 * Part of snyk-docker-plugin 9.3.0 → 9.6.0 upgrade
 *
 * Issue: com.microsoft.sqlserver:mssql-jdbc JARs (e.g., mssql-jdbc-12.10.2.jre11.jar) have
 * pom.properties files with incomplete version info (only "version=12.10.2"), causing Snyk
 * to incorrectly report them as version 12.10.2 instead of 12.10.2.jre11, leading to false
 * positive vulnerability alerts for SNYK-JAVA-COMMICROSOFTSQLSERVER-13821835.
 *
 * Fix (PR #764): Added package override to skip pom.properties JAR resolution and use
 * maven-deps for resolution instead.
 */
describe('snyk container - mssql-jdbc pom.properties fix (CN-1011)', () => {
  const isWindows = isWindowsOperatingSystem();
  const TEST_FIXTURE =
    'test/fixtures/container-projects/mssql-jdbc-pom-issue.tar';

  describeIf(!isWindows)('test', () => {
    it('does not report false positive for mssql-jdbc with .jre11 suffix', async () => {
      const { code, stdout } = await runSnykCLI(
        `container test ${TEST_FIXTURE} --json`,
      );

      expect([0, 1]).toContain(code);

      const jsonOutput = JSON.parse(stdout);
      expect(jsonOutput).toBeDefined();

      // Verify no false positive is reported for the truncated version
      // The vulnerability should only affect version 12.10.2 (without .jre suffix)
      // If the fix works, the JAR will be correctly identified as 12.10.2.jre11
      // and this vulnerability should not be reported
      const falsePositive = jsonOutput.vulnerabilities?.find(
        (vuln: any) =>
          vuln.id === 'SNYK-JAVA-COMMICROSOFTSQLSERVER-13821835' &&
          vuln.from?.some(
            (pathElement: string) =>
              pathElement.startsWith(
                'com.microsoft.sqlserver:mssql-jdbc@12.10.2',
              ) && !pathElement.includes('.jre'),
          ),
      );
      expect(falsePositive).toBeUndefined();
    });
  });
});
