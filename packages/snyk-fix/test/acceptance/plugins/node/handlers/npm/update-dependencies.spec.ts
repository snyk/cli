import * as pathLib from 'path';

import * as snykFix from '../../../../../../src';
import {
  EntityToFix,
  TestResult,
  SEVERITY,
  DependencyUpdates,
} from '../../../../../../src/types';

// Mock the @snyk/node-fix module
jest.mock('@snyk/node-fix', () => ({
  isNpmSupportedVersion: jest.fn().mockResolvedValue(true),
  isNpmOverridesSupported: jest.fn().mockResolvedValue(true),
  getNpmVersion: jest.fn().mockResolvedValue('10.0.0'),
  npmInstall: jest.fn(),
  npmUpdate: jest.fn(),
  npmInstallLockfileOnly: jest.fn(),
  MIN_NPM_VERSION: '7.0.0',
}));

// Import after mock setup
import * as npmFix from '@snyk/node-fix';
const mockNpmFix = npmFix as jest.Mocked<typeof npmFix>;

describe('fix npm projects', () => {
  beforeAll(() => {
    mockNpmFix.isNpmSupportedVersion.mockResolvedValue(true);
    mockNpmFix.isNpmOverridesSupported.mockResolvedValue(true);
  });

  beforeEach(() => {
    jest.clearAllMocks();
    mockNpmFix.isNpmSupportedVersion.mockResolvedValue(true);
    mockNpmFix.isNpmOverridesSupported.mockResolvedValue(true);
  });

  const workspacesPath = pathLib.resolve(__dirname, 'workspaces');

  function createEntityToFix(
    targetFile: string,
    testResult: TestResult,
  ): EntityToFix {
    return {
      workspace: {
        path: workspacesPath,
        readFile: async (path: string) => {
          const fs = await import('fs');
          const fullPath = pathLib.resolve(workspacesPath, path);
          return fs.readFileSync(fullPath, 'utf-8');
        },
        writeFile: async () => {},
      },
      scanResult: {
        identity: {
          type: 'npm',
          targetFile,
        },
        facts: [],
      },
      testResult,
      options: {},
    };
  }

  function createTestResult(
    upgrades: Record<string, { upgradeTo: string; vulns: string[]; upgrades: string[] }>,
  ): TestResult {
    return {
      issues: Object.entries(upgrades).map(([pkg, data]) => ({
        pkgName: pkg.split('@')[0],
        pkgVersion: pkg.split('@')[1],
        issueId: data.vulns[0] || 'VULN-1',
        fixInfo: {},
      })),
      issuesData: {
        'VULN-1': { id: 'VULN-1', severity: SEVERITY.HIGH, title: 'Test vuln' },
        'SNYK-JS-LODASH-1234': {
          id: 'SNYK-JS-LODASH-1234',
          severity: SEVERITY.HIGH,
          title: 'Lodash vuln',
        },
        'SNYK-JS-AXIOS-5678': {
          id: 'SNYK-JS-AXIOS-5678',
          severity: SEVERITY.HIGH,
          title: 'Axios vuln',
        },
        'SNYK-1': { id: 'SNYK-1', severity: SEVERITY.HIGH, title: 'Vuln 1' },
        'SNYK-2': { id: 'SNYK-2', severity: SEVERITY.HIGH, title: 'Vuln 2' },
      },
      depGraphData: {} as any,
      remediation: {
        unresolved: [],
        upgrade: upgrades as DependencyUpdates,
        patch: {},
        ignore: {},
        pin: {},
      },
    };
  }

  describe('dry-run mode', () => {
    it('shows expected changes without executing npm commands', async () => {
      const testResult = createTestResult({
        'lodash@4.17.15': {
          upgradeTo: 'lodash@4.17.21',
          vulns: ['SNYK-JS-LODASH-1234'],
          upgrades: ['lodash@4.17.15'],
        },
      });

      const entityToFix = createEntityToFix(
        'with-lodash-upgrade/package-lock.json',
        testResult,
      );

      const result = await snykFix.fix([entityToFix], {
        quiet: true,
        stripAnsi: true,
        dryRun: true,
      });

      expect(result.results.node?.succeeded).toHaveLength(1);
      expect(result.results.node?.succeeded[0].changes).toContainEqual(
        expect.objectContaining({
          success: true,
          userMessage: expect.stringContaining('lodash'),
        }),
      );
      // npm commands should NOT be called in dry-run
      expect(mockNpmFix.npmInstall).not.toHaveBeenCalled();
      expect(mockNpmFix.npmUpdate).not.toHaveBeenCalled();
    });
  });

  describe('npm update (within semver range)', () => {
    it('uses npm update when fix is within semver range', async () => {
      mockNpmFix.npmUpdate.mockResolvedValue({
        exitCode: 0,
        stdout: 'updated 1 package',
        stderr: '',
        command: 'npm update lodash',
        duration: 1000,
      });

      const testResult = createTestResult({
        'lodash@4.17.15': {
          upgradeTo: 'lodash@4.17.21',
          vulns: ['SNYK-JS-LODASH-1234'],
          upgrades: ['lodash@4.17.15'],
        },
      });

      const entityToFix = createEntityToFix(
        'with-lodash-upgrade/package-lock.json',
        testResult,
      );

      const result = await snykFix.fix([entityToFix], {
        quiet: true,
        stripAnsi: true,
      });

      expect(result.results.node?.succeeded).toHaveLength(1);
      expect(mockNpmFix.npmUpdate).toHaveBeenCalledWith(
        expect.stringContaining('with-lodash-upgrade'),
        ['lodash'],
      );
      expect(mockNpmFix.npmInstall).not.toHaveBeenCalled();
    });
  });

  describe('npm install (outside semver range)', () => {
    it('uses npm install when fix is outside semver range', async () => {
      mockNpmFix.npmInstall.mockResolvedValue({
        exitCode: 0,
        stdout: 'added 1 package',
        stderr: '',
        command: 'npm install axios@1.6.0',
        duration: 2000,
      });

      const testResult = createTestResult({
        'axios@0.21.0': {
          upgradeTo: 'axios@1.6.0',
          vulns: ['SNYK-JS-AXIOS-5678'],
          upgrades: ['axios@0.21.0'],
        },
      });

      const entityToFix = createEntityToFix(
        'with-axios-upgrade/package-lock.json',
        testResult,
      );

      const result = await snykFix.fix([entityToFix], {
        quiet: true,
        stripAnsi: true,
      });

      expect(result.results.node?.succeeded).toHaveLength(1);
      expect(mockNpmFix.npmInstall).toHaveBeenCalledWith(
        expect.stringContaining('with-axios-upgrade'),
        ['axios@1.6.0'],
      );
    });
  });

  describe('mixed upgrades', () => {
    it('batches npm update and npm install separately', async () => {
      mockNpmFix.npmUpdate.mockResolvedValue({
        exitCode: 0,
        stdout: 'updated packages',
        stderr: '',
        command: 'npm update',
        duration: 1000,
      });
      mockNpmFix.npmInstall.mockResolvedValue({
        exitCode: 0,
        stdout: 'installed packages',
        stderr: '',
        command: 'npm install',
        duration: 2000,
      });

      const testResult = createTestResult({
        'lodash@4.17.15': {
          upgradeTo: 'lodash@4.17.21', // within ^4.17.0 range
          vulns: ['SNYK-1'],
          upgrades: ['lodash@4.17.15'],
        },
        'axios@0.21.0': {
          upgradeTo: 'axios@1.6.0', // outside ^0.21.0 range
          vulns: ['SNYK-2'],
          upgrades: ['axios@0.21.0'],
        },
      });

      const entityToFix = createEntityToFix(
        'with-mixed-upgrades/package-lock.json',
        testResult,
      );

      const result = await snykFix.fix([entityToFix], {
        quiet: true,
        stripAnsi: true,
      });

      expect(result.results.node?.succeeded).toHaveLength(1);
      expect(mockNpmFix.npmUpdate).toHaveBeenCalled();
      expect(mockNpmFix.npmInstall).toHaveBeenCalled();
    });
  });

  describe('failure handling', () => {
    it('reports failure when npm update fails', async () => {
      mockNpmFix.npmUpdate.mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'npm ERR! peer dep missing',
        command: 'npm update lodash',
        duration: 1000,
      });

      const testResult = createTestResult({
        'lodash@4.17.15': {
          upgradeTo: 'lodash@4.17.21',
          vulns: ['SNYK-JS-LODASH-1234'],
          upgrades: ['lodash@4.17.15'],
        },
      });

      const entityToFix = createEntityToFix(
        'with-lodash-upgrade/package-lock.json',
        testResult,
      );

      const result = await snykFix.fix([entityToFix], {
        quiet: true,
        stripAnsi: true,
      });

      expect(result.results.node?.failed).toHaveLength(1);
      expect(result.results.node?.failed[0]).toMatchObject({
        original: entityToFix,
        changes: expect.arrayContaining([
          expect.objectContaining({
            success: false,
            reason: expect.stringContaining('peer dep'),
          }),
        ]),
      });
    });

    it('skips project when npm is not supported version', async () => {
      mockNpmFix.isNpmSupportedVersion.mockResolvedValue(false);

      const testResult = createTestResult({
        'lodash@4.17.15': {
          upgradeTo: 'lodash@4.17.21',
          vulns: ['SNYK-JS-LODASH-1234'],
          upgrades: ['lodash@4.17.15'],
        },
      });

      const entityToFix = createEntityToFix(
        'with-lodash-upgrade/package-lock.json',
        testResult,
      );

      const result = await snykFix.fix([entityToFix], {
        quiet: true,
        stripAnsi: true,
      });

      expect(result.results.node?.skipped).toHaveLength(1);
      expect(result.results.node?.skipped[0].userMessage).toContain('npm');
    });
  });

  describe('no remediation data', () => {
    it('skips project when there is no remediation data', async () => {
      const testResult: TestResult = {
        issues: [],
        issuesData: {},
        depGraphData: {} as any,
        // No remediation property
      };

      const entityToFix = createEntityToFix(
        'with-lodash-upgrade/package-lock.json',
        testResult,
      );

      const result = await snykFix.fix([entityToFix], {
        quiet: true,
        stripAnsi: true,
      });

      // When there's no remediation data, the project is skipped
      // Either in node.skipped or as an exception
      const skipped = result.results.node?.skipped ?? [];
      const hasNoNodeResults = result.results.node === undefined;

      expect(skipped.length > 0 || hasNoNodeResults).toBe(true);
      expect(mockNpmFix.npmUpdate).not.toHaveBeenCalled();
      expect(mockNpmFix.npmInstall).not.toHaveBeenCalled();
    });
  });

  describe('overrides (opt-in)', () => {
    it('does not apply overrides when useOverrides is not set', async () => {
      mockNpmFix.npmUpdate.mockResolvedValue({
        exitCode: 0,
        stdout: 'updated',
        stderr: '',
        command: 'npm update',
        duration: 1000,
      });

      const testResult = createTestResult({
        'lodash@4.17.15': {
          upgradeTo: 'lodash@4.17.21',
          vulns: ['SNYK-1'],
          upgrades: ['lodash@4.17.15'],
        },
      });

      const entityToFix = createEntityToFix(
        'with-lodash-upgrade/package-lock.json',
        testResult,
      );

      const result = await snykFix.fix([entityToFix], {
        quiet: true,
        stripAnsi: true,
        // useOverrides not set (defaults to false)
      });

      expect(result.results.node?.succeeded).toHaveLength(1);
      expect(mockNpmFix.npmInstallLockfileOnly).not.toHaveBeenCalled();
    });

    it('applies overrides when useOverrides is true and override needed', async () => {
      mockNpmFix.npmUpdate.mockResolvedValue({
        exitCode: 0,
        stdout: 'updated',
        stderr: '',
        command: 'npm update',
        duration: 1000,
      });
      mockNpmFix.npmInstallLockfileOnly.mockResolvedValue({
        exitCode: 0,
        stdout: 'lockfile synced',
        stderr: '',
        command: 'npm install --package-lock-only',
        duration: 500,
      });

      // Create a test result with:
      // 1. A direct dependency that can be upgraded (so the project isn't skipped)
      // 2. A transitive dependency with no upgrade path but has fixInfo.nearestFixedInVersion
      const testResult: TestResult = {
        issues: [
          {
            pkgName: 'lodash',
            pkgVersion: '4.17.15',
            issueId: 'SNYK-JS-LODASH-1234',
            fixInfo: {},
          },
          {
            pkgName: 'minimist',
            pkgVersion: '1.2.5',
            issueId: 'SNYK-JS-MINIMIST-5678',
            fixInfo: {
              nearestFixedInVersion: '1.2.6',
            },
          },
        ],
        issuesData: {
          'SNYK-JS-LODASH-1234': {
            id: 'SNYK-JS-LODASH-1234',
            severity: SEVERITY.HIGH,
            title: 'Prototype Pollution',
          },
          'SNYK-JS-MINIMIST-5678': {
            id: 'SNYK-JS-MINIMIST-5678',
            severity: SEVERITY.HIGH,
            title: 'Prototype Pollution',
          },
        },
        depGraphData: {} as any,
        remediation: {
          unresolved: [],
          upgrade: {
            // lodash can be upgraded directly
            'lodash@4.17.15': {
              upgradeTo: 'lodash@4.17.21',
              vulns: ['SNYK-JS-LODASH-1234'],
              upgrades: ['lodash@4.17.15'],
            },
            // No upgrade entry for minimist (transitive, needs override)
          },
          patch: {},
          ignore: {},
          pin: {},
        },
      };

      const entityToFix = createEntityToFix(
        'with-lodash-upgrade/package-lock.json',
        testResult,
      );

      // Import and test identifyOverrideCandidates directly
      const { identifyOverrideCandidates } = await import(
        '../../../../../../src/plugins/node/handlers/npm/update-dependencies/apply-overrides'
      );
      const candidates = identifyOverrideCandidates(entityToFix);
      expect(candidates).toHaveLength(1);
      expect(candidates[0].name).toBe('minimist');

      const result = await snykFix.fix([entityToFix], {
        quiet: true,
        stripAnsi: true,
        useOverrides: true,
      });

      // Should apply the direct upgrade AND the override
      expect(result.results.node?.succeeded).toHaveLength(1);
      expect(mockNpmFix.npmUpdate).toHaveBeenCalled();
      // Verify overrides logic was triggered
      expect(mockNpmFix.isNpmOverridesSupported).toHaveBeenCalled();
      // Note: npmInstallLockfileOnly is called for override application
      expect(mockNpmFix.npmInstallLockfileOnly).toHaveBeenCalled();
    });
  });
});
