import {
  partitionByFixType,
  PackageJsonReadError,
} from '../../../../src/plugins/node/handlers/npm/update-dependencies/partition-by-fix-type';
import { UpgradeInfo } from '../../../../src/plugins/node/handlers/npm/update-dependencies/generate-upgrades';
import { EntityToFix } from '../../../../src/types';

describe('partitionByFixType', () => {
  function createMockEntity(
    packageJson: string = '{}',
  ): EntityToFix {
    return {
      workspace: {
        path: '/test/project',
        readFile: jest.fn().mockResolvedValue(packageJson),
        writeFile: jest.fn(),
      },
      scanResult: {
        identity: {
          type: 'npm',
          targetFile: 'package-lock.json',
        },
        facts: [],
      },
      testResult: {
        issues: [],
        issuesData: {},
        depGraphData: {} as any,
        remediation: {
          upgrade: {},
          pin: {},
          patch: {},
          unresolved: [],
          ignore: {},
        },
      },
      options: {},
    };
  }

  const upgrades: UpgradeInfo[] = [
    {
      name: 'lodash',
      currentVersion: '4.17.15',
      targetVersion: '4.17.21',
      issueIds: ['SNYK-1'],
    },
    {
      name: 'express',
      currentVersion: '4.17.0',
      targetVersion: '4.18.2',
      issueIds: ['SNYK-2'],
    },
    {
      name: 'axios',
      currentVersion: '0.21.0',
      targetVersion: '1.6.0',
      issueIds: ['SNYK-3'],
    },
  ];

  it('should partition upgrades within semver range to withinRange', async () => {
    const packageJson = JSON.stringify({
      dependencies: {
        lodash: '^4.17.0', // 4.17.21 satisfies ^4.17.0
        express: '^4.0.0', // 4.18.2 satisfies ^4.0.0
        axios: '^0.21.0', // 1.6.0 does NOT satisfy ^0.21.0
      },
    });

    const entity = createMockEntity(packageJson);
    const result = await partitionByFixType(entity, upgrades);

    expect(result.withinRange).toHaveLength(2);
    expect(result.withinRange.map((u) => u.name)).toContain('lodash');
    expect(result.withinRange.map((u) => u.name)).toContain('express');

    expect(result.outsideRange).toHaveLength(1);
    expect(result.outsideRange[0].name).toBe('axios');
  });

  it('should throw PackageJsonReadError when package.json cannot be read', async () => {
    const entity = createMockEntity('{}');
    entity.workspace.readFile = jest.fn().mockRejectedValue(new Error('File not found'));

    await expect(partitionByFixType(entity, upgrades)).rejects.toThrow(
      PackageJsonReadError,
    );
    await expect(partitionByFixType(entity, upgrades)).rejects.toThrow(
      'Could not read package.json',
    );
  });

  it('should handle devDependencies', async () => {
    const packageJson = JSON.stringify({
      dependencies: {
        lodash: '^4.17.0',
      },
      devDependencies: {
        express: '^4.0.0',
      },
    });

    const entity = createMockEntity(packageJson);
    const result = await partitionByFixType(entity, [
      upgrades[0], // lodash
      upgrades[1], // express
    ]);

    expect(result.withinRange).toHaveLength(2);
    expect(result.outsideRange).toHaveLength(0);
  });

  it('should handle exact versions that do not satisfy', async () => {
    const packageJson = JSON.stringify({
      dependencies: {
        lodash: '4.17.15', // exact version, 4.17.21 does NOT satisfy
      },
    });

    const entity = createMockEntity(packageJson);
    const result = await partitionByFixType(entity, [upgrades[0]]);

    expect(result.withinRange).toHaveLength(0);
    expect(result.outsideRange).toHaveLength(1);
  });
});

