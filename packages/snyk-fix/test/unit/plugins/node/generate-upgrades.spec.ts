import { generateUpgrades } from '../../../../src/plugins/node/handlers/npm/update-dependencies/generate-upgrades';
import { EntityToFix } from '../../../../src/types';

describe('generateUpgrades', () => {
  function createMockEntity(
    remediation: any = {},
  ): EntityToFix {
    return {
      workspace: {
        path: '/test/project',
        readFile: jest.fn(),
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
        remediation,
      },
      options: {},
    };
  }

  it('should generate upgrades from remediation data', async () => {
    const entity = createMockEntity({
      upgrade: {
        'lodash@4.17.15': {
          upgradeTo: 'lodash@4.17.21',
          vulns: ['SNYK-JS-LODASH-1234'],
          upgrades: ['lodash@4.17.15'],
        },
        'express@4.17.0': {
          upgradeTo: 'express@4.18.2',
          vulns: ['SNYK-JS-EXPRESS-5678'],
          upgrades: ['express@4.17.0'],
        },
      },
      pin: {},
      patch: {},
      unresolved: [],
      ignore: {},
    });

    const upgrades = await generateUpgrades(entity);

    expect(upgrades).toHaveLength(2);
    expect(upgrades).toContainEqual({
      name: 'lodash',
      currentVersion: '4.17.15',
      targetVersion: '4.17.21',
      issueIds: ['SNYK-JS-LODASH-1234'],
    });
    expect(upgrades).toContainEqual({
      name: 'express',
      currentVersion: '4.17.0',
      targetVersion: '4.18.2',
      issueIds: ['SNYK-JS-EXPRESS-5678'],
    });
  });

  it('should handle scoped packages', async () => {
    const entity = createMockEntity({
      upgrade: {
        '@angular/core@12.0.0': {
          upgradeTo: '@angular/core@14.0.0',
          vulns: ['SNYK-JS-ANGULAR-1111'],
          upgrades: ['@angular/core@12.0.0'],
        },
      },
      pin: {},
      patch: {},
      unresolved: [],
      ignore: {},
    });

    const upgrades = await generateUpgrades(entity);

    expect(upgrades).toHaveLength(1);
    expect(upgrades[0]).toEqual({
      name: '@angular/core',
      currentVersion: '12.0.0',
      targetVersion: '14.0.0',
      issueIds: ['SNYK-JS-ANGULAR-1111'],
    });
  });

  it('should return empty array when no remediation data', async () => {
    const entity = createMockEntity(undefined);

    const upgrades = await generateUpgrades(entity);

    expect(upgrades).toHaveLength(0);
  });

  it('should return empty array when no upgrades available', async () => {
    const entity = createMockEntity({
      upgrade: {},
      pin: {},
      patch: {},
      unresolved: [],
      ignore: {},
    });

    const upgrades = await generateUpgrades(entity);

    expect(upgrades).toHaveLength(0);
  });
});

