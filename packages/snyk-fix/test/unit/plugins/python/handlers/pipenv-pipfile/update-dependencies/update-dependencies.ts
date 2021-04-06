import {
  generateSuccessfulChanges,
  generateUpgrades,
} from '../../../../../../../src/plugins/python/handlers/pipenv-pipfile/update-dependencies';

describe('generateUpgrades', () => {
  it('generates upgrades as expected', async () => {
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

    // Act
    const res = await generateUpgrades(pinRemediation);
    // Assert
    expect(res).toEqual(['django>=2.0.1', 'transitive>=1.1.1']);
  });
  it('returns [] when no pins available', async () => {
    // Arrange
    // Act
    const res = await generateUpgrades({});
    // Assert
    expect(res).toEqual([]);
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
    const res = await generateSuccessfulChanges(pinRemediation);
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
    const res = await generateSuccessfulChanges({});
    // Assert
    expect(res).toEqual([]);
  });
});
