import * as pathLib from 'path';
import { SupportedPackageManagers } from '../../../../../src/lib/package-managers';
import { filterOutProcessedYarnWorkspaces } from '../../../../../src/lib/plugins/get-multi-plugin-result';

const root = '../../../../acceptance/workspaces/yarn-workspaces';
describe('filterOutProcessedYarnWorkspaces', () => {
  test('all package.json belong to the same workspace', () => {
    const allTargetFiles = [
      'yarn.lock',
      'packages/tomatoes/yarn.lock',
      'packages/apples/package.json',
    ];
    const unprocessedFiles = filterOutProcessedYarnWorkspaces(
      root,
      scannedProjects as any,
      allTargetFiles,
    );
    expect(unprocessedFiles).toEqual([]);
  });
  test('all package.json belong to the multiple workspace', () => {
    const allTargetFiles = [
      'yarn.lock',
      'packages/tomatoes/yarn.lock',
      'packages/apples/package.json',
    ].map((p) => pathLib.resolve(root, p));
    const unprocessedFiles = filterOutProcessedYarnWorkspaces(
      root,
      scannedProjects as any,
      allTargetFiles,
    );
    expect(unprocessedFiles).toEqual([]);
  });

  test('1 package.json (yarn) does not belong to a workspace', () => {
    const allTargetFiles = [
      'yarn.lock',
      'not-part-of-workspace-yarn/yarn.lock',
      'packages/apples/package.json',
    ].map((p) => pathLib.resolve(root, p));
    const unprocessedFiles = filterOutProcessedYarnWorkspaces(
      root,
      scannedProjects as any,
      allTargetFiles,
    );
    expect(unprocessedFiles).toEqual(
      ['not-part-of-workspace-yarn/yarn.lock'].map((p) =>
        pathLib.resolve(root, p),
      ),
    );
  });

  test('1 package.json (npm) does not belong to a workspace', () => {
    const allTargetFiles = [
      'yarn.lock',
      'not-part-of-workspace-yarn/yarn.lock',
      'packages/apples/package.json',
    ].map((p) => pathLib.resolve(root, p));
    const unprocessedFiles = filterOutProcessedYarnWorkspaces(
      root,
      scannedProjects as any,
      allTargetFiles,
    );
    expect(unprocessedFiles).toEqual(
      ['not-part-of-workspace-yarn/yarn.lock'].map((p) =>
        pathLib.resolve(root, p),
      ),
    );
  });

  test('multiple mixed files do not belong to a workspace', () => {
    const allTargetFiles = [
      'requirements.txt',
      'not-part-of-workspace-yarn/Pipfile.lock',
      'yarn.lock',
      'not-part-of-workspace-yarn/yarn.lock',
      'packages/apples/package.json',
      'packages/apples/Pipfile',
    ].map((p) => pathLib.resolve(root, p));
    const unprocessedFiles = filterOutProcessedYarnWorkspaces(
      root,
      scannedProjects as any,
      allTargetFiles,
    );
    expect(unprocessedFiles.sort()).toEqual(
      [
        'not-part-of-workspace-yarn/yarn.lock',
        'requirements.txt',
        'not-part-of-workspace-yarn/Pipfile.lock',
        'packages/apples/Pipfile',
      ]
        .sort()
        .map((p) => pathLib.resolve(root, p)),
    );
  });
});

const scannedProjects = [
  {
    packageManager: 'yarn' as SupportedPackageManagers,
    targetFile: 'package.json',
    depTree: {
      dependencies: {
        nconf: {
          labels: {
            scope: 'prod',
          },
          name: 'nconf',
          version: '0.11.3',
          dependencies: {},
        },
      },
      hasDevDependencies: false,
      name: 'snyk-yarn-test',
      size: 35,
      version: '1.0.0',
      meta: {
        lockfileVersion: 1,
        packageManager: 'yarn',
      },
    },
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: 'v12.20.1',
    },
  },
  {
    packageManager: 'yarn' as SupportedPackageManagers,
    targetFile: 'packages/apples/package.json',
    depTree: {
      dependencies: {
        underscore: {
          labels: {
            scope: 'prod',
          },
          name: 'underscore',
          version: '1.10.1',
        },
      },
      hasDevDependencies: false,
      name: 'packages/apples',
      size: 2,
      version: '1.0.0',
      meta: {
        lockfileVersion: 1,
        packageManager: 'yarn',
      },
    },
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: 'v12.20.1',
    },
  },
  {
    packageManager: 'yarn' as SupportedPackageManagers,
    targetFile: 'packages/tomatoes/package.json',
    depTree: {
      dependencies: {
        underscore: {
          labels: {
            scope: 'prod',
          },
          name: 'underscore',
          version: '1.10.1',
        },
      },
      hasDevDependencies: false,
      name: 'packages/apples',
      size: 2,
      version: '1.0.0',
      meta: {
        lockfileVersion: 1,
        packageManager: 'yarn',
      },
    },
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: 'v12.20.1',
    },
  },
];
