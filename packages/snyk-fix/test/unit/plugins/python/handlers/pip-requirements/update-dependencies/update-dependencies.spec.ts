import { readFileSync } from 'fs';
import * as path from 'path';
import { updateDependencies } from '../../../../../../../src/plugins/python/handlers/pip-requirements/update-dependencies';
import { parseRequirementsFile } from '../../../../../../../src/plugins/python/handlers/pip-requirements/update-dependencies/requirements-file-parser';

describe('remediation', () => {
  it('does not add extra new lines', () => {
    const upgrades = {
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

    const expectedManifest =
      'Django==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability';

    const requirements = parseRequirementsFile(manifestContents);
    const result = updateDependencies(requirements, upgrades);
    expect(result.changes.map((c) => c.userMessage).sort()).toEqual(
      [
        'Upgraded Django from 1.6.1 to 2.0.1',
        'Pinned transitive from 1.0.0 to 1.1.1',
      ].sort(),
    );
    // Note no extra newline was added to the expected manifest
    expect(result.updatedManifest).toEqual(expectedManifest);
  });

  it('retains new line at eof', () => {
    const upgrades = {
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

    const manifestContents = 'Django==1.6.1\n';

    const expectedManifest =
      'Django==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability\n';

    const requirements = parseRequirementsFile(manifestContents);
    const result = updateDependencies(requirements, upgrades);
    expect(result.changes.map((c) => c.userMessage).sort()).toEqual(
      [
        'Upgraded Django from 1.6.1 to 2.0.1',
        'Pinned transitive from 1.0.0 to 1.1.1',
      ].sort(),
    );
    expect(result.updatedManifest).toEqual(expectedManifest);
  });

  it('does not mess formatting', () => {
    const upgrades = {
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

    const manifestContents = '\n#some comment\n\nDjango==1.6.1\n';

    const expectedManifest =
      '\n#some comment\n\nDjango==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability\n';

    const requirements = parseRequirementsFile(manifestContents);
    const result = updateDependencies(requirements, upgrades);
    expect(result.changes.map((c) => c.userMessage).sort()).toEqual(
      [
        'Upgraded Django from 1.6.1 to 2.0.1',
        'Pinned transitive from 1.0.0 to 1.1.1',
      ].sort(),
    );
    expect(result.updatedManifest).toEqual(expectedManifest);
  });

  it('ignores casing in upgrades (treats all as lowercase)', () => {
    const upgrades = {
      'Django@1.6.1': {
        upgradeTo: 'Django@2.0.1',
        vulns: [],
        upgrades: [],
        isTransitive: false,
      },
    };

    const manifestContents = 'django==1.6.1\n';

    const expectedManifest = 'django==2.0.1\n';
    const requirements = parseRequirementsFile(manifestContents);
    const result = updateDependencies(requirements, upgrades);
    expect(result.changes[0].userMessage).toEqual(
      'Upgraded django from 1.6.1 to 2.0.1',
    );
    expect(result.updatedManifest).toEqual(expectedManifest);
  });

  it('maintains package name casing when upgrading', () => {
    const upgrades = {
      'django@1.6.1': {
        upgradeTo: 'django@2.0.1',
        vulns: [],
        upgrades: [],
        isTransitive: false,
      },
    };

    const manifestContents = 'Django==1.6.1\n';

    const expectedManifest = 'Django==2.0.1\n';

    const requirements = parseRequirementsFile(manifestContents);
    const result = updateDependencies(requirements, upgrades);
    expect(result.changes[0].userMessage).toEqual(
      'Upgraded Django from 1.6.1 to 2.0.1',
    );
    expect(result.updatedManifest).toEqual(expectedManifest);
  });

  it('matches a package with multiple digit versions i.e. 12.123.14', () => {
    const upgrades = {
      'foo@12.123.14': {
        upgradeTo: 'foo@55.66.7',
        vulns: [],
        upgrades: [],
        isTransitive: false,
      },
    };

    const manifestContents = 'foo==12.123.14\n';

    const expectedManifest = 'foo==55.66.7\n';

    const requirements = parseRequirementsFile(manifestContents);
    const result = updateDependencies(requirements, upgrades);
    expect(result.changes[0].userMessage).toEqual(
      'Upgraded foo from 12.123.14 to 55.66.7',
    );
    expect(result.updatedManifest).toEqual(expectedManifest);
  });

  it('maintains comments when upgrading', () => {
    const upgrades = {
      'django@1.6.1': {
        upgradeTo: 'django@2.0.1',
        vulns: [],
        upgrades: [],
        isTransitive: false,
      },
    };

    const manifestContents = 'django==1.6.1 # this is a comment\n';

    const expectedManifest = 'django==2.0.1 # this is a comment\n';

    const requirements = parseRequirementsFile(manifestContents);
    const result = updateDependencies(requirements, upgrades);
    expect(result.changes[0].userMessage).toEqual(
      'Upgraded django from 1.6.1 to 2.0.1',
    );
    expect(result.updatedManifest).toEqual(expectedManifest);
  });

  it('maintains version comparator when upgrading', () => {
    const upgrades = {
      'django@1.6.1': {
        upgradeTo: 'django@2.0.1',
        vulns: [],
        upgrades: [],
        isTransitive: false,
      },
      'click@7.0': {
        upgradeTo: 'click@7.1',
        vulns: [],
        upgrades: [],
        isTransitive: false,
      },
    };

    const manifestContents = 'django>=1.6.1\nclick>7.0';

    const expectedManifest = 'django>=2.0.1\nclick>7.1';

    const requirements = parseRequirementsFile(manifestContents);
    const result = updateDependencies(requirements, upgrades);
    expect(result.changes.map((c) => c.userMessage)).toEqual([
      'Upgraded django from 1.6.1 to 2.0.1',
      'Upgraded click from 7.0 to 7.1',
    ]);
    expect(result.updatedManifest).toEqual(expectedManifest);
  });

  it('fixes a pip app', () => {
    const upgrades = {
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

    const manifestContents = readFileSync(
      path.resolve(
        __dirname,
        '../../../',
        'workspaces',
        'pip-app',
        'requirements.txt',
      ),
      'utf8',
    );

    const requirements = parseRequirementsFile(manifestContents);
    const result = updateDependencies(requirements, upgrades);
    expect(result.changes.map((c) => c.userMessage).sort()).toEqual(
      [
        'Upgraded Django from 1.6.1 to 2.0.1',
        'Pinned transitive from 1.0.0 to 1.1.1',
      ].sort(),
    );
    expect(result.updatedManifest).toMatchSnapshot();
  });

  it('retains python markers', () => {
    const upgrades = {
      'click@7.0': {
        upgradeTo: 'click@7.1',
        vulns: [],
        upgrades: [],
        isTransitive: false,
      },
    };

    const manifestContents = readFileSync(
      path.resolve(
        __dirname,
        '../../../',
        'workspaces',
        'pip-app-with-python-markers',
        'requirements.txt',
      ),
      'utf8',
    );

    const requirements = parseRequirementsFile(manifestContents);
    const result = updateDependencies(requirements, upgrades);
    expect(result.changes[0].userMessage).toEqual(
      'Upgraded click from 7.0 to 7.1',
    );
    expect(result.updatedManifest).toMatchSnapshot();
  });
  it('handles no-op upgrades', () => {
    const upgrades = {};

    const manifestContents = readFileSync(
      path.resolve(
        __dirname,
        '../../../',

        'workspaces',
        'pip-app',
        'requirements.txt',
      ),
      'utf8',
    );
    const requirements = parseRequirementsFile(manifestContents);

    try {
      updateDependencies(requirements, upgrades);
    } catch (e) {
      expect(e.message).toEqual(
        'No fixes could be applied. Please contact support@snyk.io',
      );
    }
  });
  it('skips pins if asked', () => {
    const upgrades = {
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

    const expectedManifest =
      'Django==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability';
    const directUpgradesOnly = false;
    const requirements = parseRequirementsFile(manifestContents);
    const result = updateDependencies(
      requirements,
      upgrades,
      directUpgradesOnly,
    );
    expect(result.changes.map((c) => c.userMessage).sort()).toEqual(
      [
        'Pinned transitive from 1.0.0 to 1.1.1',
        'Upgraded Django from 1.6.1 to 2.0.1',
      ].sort(),
    );
    // Note no extra newline was added to the expected manifest
    expect(result.updatedManifest).toEqual(expectedManifest);
  });
});
