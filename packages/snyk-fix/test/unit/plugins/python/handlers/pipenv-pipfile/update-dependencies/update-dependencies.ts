import { generateSuccessfulChanges } from '../../../../../../../src/plugins/python/handlers/attempted-changes-summary';
import { generateUpgrades } from '../../../../../../../src/plugins/python/handlers/pipenv-pipfile/update-dependencies/generate-upgrades';
import { generateEntityToFix } from '../../../../../../helpers/generate-entity-to-fix';

describe('generateUpgrades', () => {
  it('generates upgrades as expected', async () => {
    const entityToFix = generateEntityToFix('pip', 'Pipfile', '');
    // Arrange
    const pinRemediation = {
      'django@1.6.1': {
        upgradeTo: 'django@2.0.1',
        vulns: [],
        isTransitive: false,
      },
      'transitive@1.0.0': {
        upgradeTo: 'transitive@1.1.1',
        vulns: [],
        isTransitive: true,
      },
    };
    (entityToFix.testResult as any).remediation = {
      ignore: {},
      patch: {},
      pin: pinRemediation,
      unresolved: [],
      // only pins are supported for Python
      upgrade: {
        'json-api@0.1.21': {
          upgradeTo: 'json-api@0.1.22',
          upgrades: ['json-api@0.1.22'],
          vulns: ['pip:json-api:20170213'],
          isTransitive: false,
        },
      },
    };

    // Act
    const { upgrades } = await generateUpgrades(entityToFix);
    // Assert
    expect(upgrades).toEqual(['django>=2.0.1', 'transitive>=1.1.1']);
  });
  it('returns [] when no pins available', async () => {
    // Arrange
    const entityToFix = generateEntityToFix('pip', 'Pipfile', '');
    // Arrange
    (entityToFix.testResult as any).remediation = {
      ignore: {},
      patch: {},
      pin: {},
      unresolved: [],
      // only pins are supported for Python
      upgrade: {
        'json-api@0.1.21': {
          upgradeTo: 'json-api@0.1.22',
          upgrades: ['json-api@0.1.22'],
          vulns: ['pip:json-api:20170213'],
          isTransitive: false,
        },
      },
    };
    // Act
    const { upgrades } = await generateUpgrades(entityToFix);
    // Assert
    expect(upgrades).toEqual([]);
  });
});

describe('generateSuccessfulChanges', () => {
  it('generates applied changes for upgrades & pins', async () => {
    // Arrange
    const pinRemediation = {
      'django@1.6.1': {
        upgradeTo: 'django@2.0.1',
        vulns: ['vuln-1'],
        isTransitive: false,
      },
      'transitive@1.0.0': {
        upgradeTo: 'transitive@1.1.1',
        vulns: ['vuln-2', 'vuln-3'],
        isTransitive: true,
      },
    };

    // Act
    const res = await generateSuccessfulChanges(
      ['django===2.0.1', 'transitive==1.1.1'],
      pinRemediation,
    );
    // Assert
    expect(res).toEqual([
      {
        from: 'django@1.6.1',
        issueIds: ['vuln-1'],
        success: true,
        to: 'django@2.0.1',
        userMessage: 'Upgraded django from 1.6.1 to 2.0.1',
      },
      {
        from: 'transitive@1.0.0',
        issueIds: ['vuln-2', 'vuln-3'],
        success: true,
        to: 'transitive@1.1.1',
        userMessage: 'Pinned transitive from 1.0.0 to 1.1.1',
      },
    ]);
  });
  it('returns [] when no pins available', async () => {
    // Arrange
    // Act
    const res = await generateSuccessfulChanges([], {});
    // Assert
    expect(res).toEqual([]);
  });
});
