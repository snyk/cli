import {
  packageJsonBelongsToWorkspace,
  processYarnWorkspaces,
} from '../../../../../src/lib/plugins/nodejs-plugin/yarn-workspaces-parser';
import * as path from 'path';

const yarnWorkspacesMap = {
  'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/package.json': {
    workspaces: ['packages/*'],
  },
  'snyk/test/acceptance/workspaces/yarn-workspace/package.json': {
    workspaces: ['libs/*/**', 'tools/*'],
  },
};

const yarnWorkspacesMapWindows = {
  'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\package.json':
    {
      workspaces: ['packages/*'],
    },
  'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace\\package.json': {
    workspaces: ['libs/*/**', 'tools/*'],
  },
  'C:\\snyk\\yarn-workspace\\package.json': {
    workspaces: ['libs\\*\\**', 'tools\\*'],
  },
};
describe('packageJsonBelongsToWorkspace', () => {
  test('does not match workspace root', () => {
    const packageJsonFileName =
      'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/package.json';
    const workspaceRoot =
      'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMap,
        workspaceRoot,
      ),
    ).toBeFalsy();
  });
  test('correctly matches a workspace with /* globs (meaning all folders)', () => {
    // docs: https://yarnpkg.com/features/workspaces#how-to-declare-a-worktree
    const packageJsonFileName =
      'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/packages/apple/package.json';
    const workspaceRoot =
      'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMap,
        workspaceRoot,
      ),
    ).toBeTruthy();
  });

  test('correctly matches a workspace with /*/** globs', () => {
    const packageJsonFileName =
      'snyk/test/acceptance/workspaces/yarn-workspace/libs/a/package.json';
    const workspaceRoot =
      'snyk/test/acceptance/workspaces/yarn-workspace/package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMap,
        workspaceRoot,
      ),
    ).toBeTruthy();
  });

  test('does not match a workspace outside declared globs', () => {
    const packageJsonFileName =
      'snyk/test/acceptance/workspaces/yarn-workspace/packages/a/package.json';
    const workspaceRoot =
      'snyk/test/acceptance/workspaces/yarn-workspace/package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMap,
        workspaceRoot,
      ),
    ).toBeFalsy();
  });

  test('does not match deeply nested packages with /* glob', () => {
    // packages/* should only match direct children, not nested packages
    const packageJsonFileName =
      'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/packages/not_a_workspace/deeply_nested/package.json';
    const workspaceRoot =
      'snyk/test/acceptance/workspaces/yarn-workspace-out-of-sync/package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMap,
        workspaceRoot,
      ),
    ).toBeFalsy();
  });
});

describe('packageJsonBelongsToWorkspace Windows', () => {
  test('does not match workspace root', () => {
    const packageJsonFileName =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\package.json';
    const workspaceRoot =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMapWindows,
        workspaceRoot,
      ),
    ).toBeFalsy();
  });
  test('correctly matches a workspace with /* globs (meaning all folders)', () => {
    // docs: https://yarnpkg.com/features/workspaces#how-to-declare-a-worktree
    const packageJsonFileName =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\packages\\apple\\package.json';
    const workspaceRoot =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMapWindows,
        workspaceRoot,
      ),
    ).toBeTruthy();
  });

  test('correctly matches a workspace with \\* globs (meaning all folders)', () => {
    // docs: https://yarnpkg.com/features/workspaces#how-to-declare-a-worktree
    const packageJsonFileName =
      'C:\\snyk\\yarn-workspace\\tools\\apple\\package.json';
    const workspaceRoot = 'C:\\snyk\\yarn-workspace\\package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMapWindows,
        workspaceRoot,
      ),
    ).toBeTruthy();
  });

  test('correctly matches a workspace with /*/** globs', () => {
    const packageJsonFileName =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace\\libs\\a\\package.json';
    const workspaceRoot =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace\\package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMapWindows,
        workspaceRoot,
      ),
    ).toBeTruthy();
  });

  test('does not match a workspace outside declared globs', () => {
    const packageJsonFileName =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace\\packages\\a\\package.json';
    const workspaceRoot =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace\\package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMapWindows,
        workspaceRoot,
      ),
    ).toBeFalsy();
  });

  test('does not match deeply nested packages with /* glob', () => {
    // packages/* should only match direct children, not nested packages
    const packageJsonFileName =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\packages\\not_a_workspace\\deeply_nested\\package.json';
    const workspaceRoot =
      'C:\\snyk\\test\\acceptance\\workspaces\\yarn-workspace-out-of-sync\\package.json';
    expect(
      packageJsonBelongsToWorkspace(
        packageJsonFileName,
        yarnWorkspacesMapWindows,
        workspaceRoot,
      ),
    ).toBeFalsy();
  });
});

// A Yarn Berry workspace package consumed as a production dependency must not promote its
// dev-only tooling into the production graph. The fixture has apps/my-app -> (prod)
// libraries/shared-lib, where shared-lib has ONLY devDependencies (webpack, babel, ...).
// Those must not appear in my-app's graph.
describe('processYarnWorkspaces - dev-dependency leak', () => {
  const fixtureRoot = path.resolve(
    __dirname,
    '../../../../fixtures/yarn-workspace-dev-deps',
  );

  // shared-lib's dev-only build tooling that previously leaked into my-app's prod graph.
  const DEV_ONLY_TOOLING = [
    'webpack',
    'webpack-cli',
    '@babel/core',
    '@babel/preset-env',
    'babel-loader',
  ];

  const targetFiles = [
    `${fixtureRoot}/yarn.lock`,
    `${fixtureRoot}/package.json`,
    `${fixtureRoot}/apps/my-app/package.json`,
    `${fixtureRoot}/libraries/shared-lib/package.json`,
    `${fixtureRoot}/libraries/private-lib/package.json`,
  ];

  const pkgNamesOf = (depGraph): string[] =>
    depGraph.getDepPkgs().map((p: { name: string }) => p.name);

  const myAppGraphNames = async (dev: boolean): Promise<string[]> => {
    const result = await processYarnWorkspaces(
      fixtureRoot,
      { dev },
      targetFiles,
    );
    const myApp = result.scannedProjects.find((p) =>
      p.targetFile?.includes('apps/my-app'),
    );
    if (!myApp) {
      throw new Error('my-app project was not scanned');
    }
    return pkgNamesOf(myApp.depGraph);
  };

  test('does not promote consumed workspace devDependencies to prod', async () => {
    const names = await myAppGraphNames(false);

    // shared-lib is a genuine prod dependency of my-app and must remain.
    expect(names).toContain('@demo/shared-lib');

    // None of shared-lib's dev-only tooling should be present.
    for (const devPkg of DEV_ONLY_TOOLING) {
      expect(names).not.toContain(devPkg);
    }
  });

  test('still includes consumed workspace devDependencies when --dev is set', async () => {
    const names = await myAppGraphNames(true);
    expect(names).toEqual(expect.arrayContaining(DEV_ONLY_TOOLING));
  });
});
