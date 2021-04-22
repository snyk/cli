import { generateUpgrades } from '../../../../../../../src/plugins/python/handlers/pip-requirements/update-dependencies/generate-upgrades';
import { parseRequirementsFile } from '../../../../../../../src/plugins/python/handlers/pip-requirements/update-dependencies/requirements-file-parser';

describe('generateUpgrades', () => {
  it('returns empty if no upgrades could be generated', () => {
    const updates = {
      'transitive@1.0.0': {
        upgradeTo: 'transitive@1.1.1',
        vulns: [],
        upgrades: [],
        isTransitive: true,
      },
    };

    const manifestContents = 'Django==1.6.1';

    const { requirements } = parseRequirementsFile(manifestContents);
    const result = generateUpgrades(requirements, updates);
    expect(result.changes).toEqual([]);
    expect(result.updatedRequirements).toEqual({});
  });

  it('skips upgrading if expected version does not match', () => {
    const updates = {
      'django@1.6.0': {
        upgradeTo: 'django@2.0.1',
        vulns: [],
        upgrades: [],
        isTransitive: false,
      },
      'transitive@1.0.0': {
        upgradeTo: 'transitive@1.1.1',
        vulns: [],
        upgrades: [],
        isTransitive: true,
      },
    };

    const manifestContents = 'Django==1.6.1';

    const { requirements } = parseRequirementsFile(manifestContents);
    const result = generateUpgrades(requirements, updates);
    expect(result.changes).toEqual([]);
    expect(result.updatedRequirements).toEqual({});
  });

  it('returns upgraded dep', () => {
    const updates = {
      'django@1.6.1': {
        upgradeTo: 'django@2.0.1',
        vulns: [],
        upgrades: [],
        isTransitive: false,
      },
      'transitive@1.0.0': {
        upgradeTo: 'transitive@1.1.1',
        vulns: [],
        upgrades: [],
        isTransitive: true,
      },
    };

    const manifestContents = 'Django==1.6.1';

    const { requirements } = parseRequirementsFile(manifestContents);
    const result = generateUpgrades(requirements, updates);
    expect(result.changes.map((c) => c.userMessage).sort()).toEqual(
      ['Upgraded Django from 1.6.1 to 2.0.1'].sort(),
    );
    expect(result.updatedRequirements).toEqual({
      'Django==1.6.1': 'Django==2.0.1',
    });
  });

  it('returns transitive pin even when casing is mismatched', () => {
    const updates = {
      'django@1.6.1': {
        upgradeTo: 'django@2.0.1',
        vulns: [],
        upgrades: [],
        isTransitive: false,
      },
      'Transitive@1.0.0': {
        upgradeTo: 'Transitive@1.1.1',
        vulns: [],
        upgrades: [],
        isTransitive: true,
      },
    };

    const manifestContents = 'Django==1.6.1';

    const { requirements } = parseRequirementsFile(manifestContents);
    const result = generateUpgrades(requirements, updates);
    expect(result.changes.map((c) => c.userMessage).sort()).toEqual(
      ['Upgraded Django from 1.6.1 to 2.0.1'].sort(),
    );
    expect(result.updatedRequirements).toEqual({
      'Django==1.6.1': 'Django==2.0.1',
    });
  });
});
