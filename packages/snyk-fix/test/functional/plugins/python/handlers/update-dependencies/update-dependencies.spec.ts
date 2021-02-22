import { readFileSync } from 'fs';
import * as path from 'path';
import { updateDependencies } from '../../../../../../src/plugins/python/handlers/update-dependencies';

describe('remediation', () => {
  it('does not add extra new lines', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1', vulns: [], upgrades: [] },
      'transitive@1.0.0': {
        upgradeTo: 'transitive@1.1.1',
        vulns: [],
        upgrades: [],
      },
    };

    const manifestContents = 'Django==1.6.1';

    const expectedManifest =
      'Django==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability';

    const result = updateDependencies(manifestContents, upgrades);

    // Note no extra newline was added to the expected manifest
    expect(result).toEqual(expectedManifest);
  });

  it('retains new line at eof', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1', vulns: [], upgrades: [] },
      'transitive@1.0.0': {
        upgradeTo: 'transitive@1.1.1',
        vulns: [],
        upgrades: [],
      },
    };

    const manifestContents = 'Django==1.6.1\n';

    const expectedManifest =
      'Django==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability\n';

    const result = updateDependencies(manifestContents, upgrades);

    // Note no extra newline was added to the expected manifest
    expect(result).toEqual(expectedManifest);
  });

  it('does not mess formatting', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1', vulns: [], upgrades: [] },
      'transitive@1.0.0': {
        upgradeTo: 'transitive@1.1.1',
        vulns: [],
        upgrades: [],
      },
    };

    const manifestContents = '\n#some comment\n\nDjango==1.6.1\n';

    const expectedManifest =
      '\n#some comment\n\nDjango==2.0.1\ntransitive>=1.1.1 # not directly required, pinned by Snyk to avoid a vulnerability\n';

    const result = updateDependencies(manifestContents, upgrades);

    // Note no extra newline was added to the expected manifest
    expect(result).toEqual(expectedManifest);
  });

  it('ignores casing in upgrades (treats all as lowercase)', () => {
    const upgrades = {
      'Django@1.6.1': { upgradeTo: 'Django@2.0.1', vulns: [], upgrades: [] },
    };

    const manifestContents = 'django==1.6.1\n';

    const expectedManifest = 'django==2.0.1\n';

    const result = updateDependencies(manifestContents, upgrades);

    expect(result).toEqual(expectedManifest);
  });

  it('maintains package name casing when upgrading', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1', vulns: [], upgrades: [] },
    };

    const manifestContents = 'Django==1.6.1\n';

    const expectedManifest = 'Django==2.0.1\n';

    const result = updateDependencies(manifestContents, upgrades);

    expect(result).toEqual(expectedManifest);
  });

  it('matches a package with multiple digit versions i.e. 12.123.14', () => {
    const upgrades = {
      'foo@12.123.14': { upgradeTo: 'foo@55.66.7', vulns: [], upgrades: [] },
    };

    const manifestContents = 'foo==12.123.14\n';

    const expectedManifest = 'foo==55.66.7\n';

    const result = updateDependencies(manifestContents, upgrades);

    expect(result).toEqual(expectedManifest);
  });

  it('maintains comments when upgrading', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1', vulns: [], upgrades: [] },
    };

    const manifestContents = 'django==1.6.1 # this is a comment\n';

    const expectedManifest = 'django==2.0.1 # this is a comment\n';

    const result = updateDependencies(manifestContents, upgrades);

    expect(result).toEqual(expectedManifest);
  });

  it('maintains version comparator when upgrading', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1', vulns: [], upgrades: [] },
      'click@7.0': { upgradeTo: 'click@7.1', vulns: [], upgrades: [] },
    };

    const manifestContents = 'django>=1.6.1\nclick>7.0';

    const expectedManifest = 'django>=2.0.1\nclick>7.1';

    const result = updateDependencies(manifestContents, upgrades);

    expect(result).toEqual(expectedManifest);
  });

  it('fixes a pip app', () => {
    const upgrades = {
      'django@1.6.1': { upgradeTo: 'django@2.0.1', vulns: [], upgrades: [] },
      'transitive@1.0.0': {
        upgradeTo: 'transitive@1.1.1',
        vulns: [],
        upgrades: [],
      },
    };

    const manifestContents = readFileSync(
      path.resolve(
        __dirname,
        '../../',
        'workspaces',
        'pip-app',
        'requirements.txt',
      ),
      'utf8',
    );

    const result = updateDependencies(manifestContents, upgrades);

    expect(result).toMatchSnapshot();
  });

  it('retains python markers', () => {
    const upgrades = {
      'click@7.0': { upgradeTo: 'click@7.1', vulns: [], upgrades: [] },
    };

    const manifestContents = readFileSync(
      path.resolve(
        __dirname,
        '../../',
        'workspaces',
        'pip-app-with-python-markers',
        'requirements.txt',
      ),
      'utf8',
    );

    const result = updateDependencies(manifestContents, upgrades);

    expect(result).toMatchSnapshot();
  });

  it('handles no-op upgrades', () => {
    const upgrades = {};

    const manifestContents = readFileSync(
      path.resolve(
        __dirname,
        '../../',
        'workspaces',
        'pip-app',
        'requirements.txt',
      ),
      'utf8',
    );

    const result = updateDependencies(manifestContents, upgrades);

    expect(result).toEqual(manifestContents);
  });
});
