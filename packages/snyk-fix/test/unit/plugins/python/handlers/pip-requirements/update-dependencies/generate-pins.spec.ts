import { generatePins } from '../../../../../../../src/plugins/python/handlers/pip-requirements/update-dependencies/generate-pins';
import { parseRequirementsFile } from '../../../../../../../src/plugins/python/handlers/pip-requirements/update-dependencies/requirements-file-parser';

describe('generatePins', () => {
  it('returns empty if no pins could be generated', () => {
    const updates = {
      'django@1.6.1': {
        upgradeTo: 'django@2.0.1',
        vulns: [],
        upgrades: [],
        isTransitive: false,
      },
    };

    const manifestContents = 'Django==1.6.1';

    const { requirements } = parseRequirementsFile(manifestContents);
    const result = generatePins(requirements, updates);
    expect(result.changes).toEqual([]);
    expect(result.pinnedRequirements).toEqual([]);
  });

  it('returns transitive pin', () => {
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
    const result = generatePins(requirements, updates);
    expect(result.changes.map((c) => c.userMessage).sort()).toEqual(
      ['Pinned transitive from 1.0.0 to 1.1.1'].sort(),
    );
    expect(result.pinnedRequirements).toEqual([
      'transitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability',
    ]);
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
    const result = generatePins(requirements, updates);
    expect(result.changes.map((c) => c.userMessage).sort()).toEqual(
      ['Pinned transitive from 1.0.0 to 1.1.1'].sort(),
    );
    expect(result.pinnedRequirements).toEqual([
      'transitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability',
    ]);
  });
});
