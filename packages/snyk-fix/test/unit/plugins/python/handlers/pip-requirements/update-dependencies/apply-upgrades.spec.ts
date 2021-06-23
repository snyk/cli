import { applyUpgrades } from '../../../../../../../src/plugins/python/handlers/pip-requirements/update-dependencies/apply-upgrades';
import { parseRequirementsFile } from '../../../../../../../src/plugins/python/handlers/pip-requirements/update-dependencies/requirements-file-parser';

describe('applyUpgrades', () => {
  it('returns original requirements if no upgrades available', () => {
    const updates = {};

    const manifestContents = 'Django==1.6.1';

    const { requirements } = parseRequirementsFile(manifestContents);
    const result = applyUpgrades(requirements, updates);
    expect(result).toEqual(requirements.map((o) => o.originalText));
  });

  it('returns correctly when upgrade is to itself', () => {
    const updates = {
      'Django==1.6.1': 'Django==1.6.1',
    };

    const manifestContents = 'Django==1.6.1';

    const { requirements } = parseRequirementsFile(manifestContents);
    const result = applyUpgrades(requirements, updates);
    expect(result).toEqual(['Django==1.6.1']);
  });

  it('updates correctly when upgrade is available', () => {
    const updates = {
      'django>=1.6.1': 'django==2.0.1',
    };

    const manifestContents = 'django>=1.6.1\nclick>7.0';

    const { requirements } = parseRequirementsFile(manifestContents);
    const result = applyUpgrades(requirements, updates);
    expect(result.sort()).toEqual(['click>7.0', 'django==2.0.1'].sort());
  });

  it('updates correctly when upgrade is available', () => {
    const updates = {
      "click==7.0 ; python_version > '1.0'":
        "click==7.1 ; python_version > '1.0'",
    };

    const manifestContents =
      "click==7.1 ; python_version > '1.0'\nconnexion[swagger-ui]==2.2.0";

    const { requirements } = parseRequirementsFile(manifestContents);
    const result = applyUpgrades(requirements, updates);
    expect(result.sort()).toEqual(
      [
        'connexion[swagger-ui]==2.2.0',
        "click==7.1 ; python_version > '1.0'",
      ].sort(),
    );
  });
});
