import * as pathLib from 'path';
import { SupportedPackageManagers } from '../../../../../src/lib/package-managers';
import { filterOutProcessedWorkspaces } from '../../../../../src/lib/plugins/get-multi-plugin-result';

const yarnRoot = '../../../../acceptance/workspaces/yarn-workspaces';
const pnpmRoot = '../../../../acceptance/fixtures/pnpm-workspaces';
describe('filterOutProcessedYarnWorkspaces', () => {
  test('all package.json belong to the same workspace', () => {
    const allTargetFiles = [
      'yarn.lock',
      'packages/tomatoes/yarn.lock',
      'packages/apples/package.json',
    ];
    const unprocessedFiles = filterOutProcessedWorkspaces(
      yarnRoot,
      scannedProjects as any,
      allTargetFiles,
      'yarn.lock',
    );
    expect(unprocessedFiles).toEqual([]);
  });
  test('all package.json belong to the multiple workspace', () => {
    const allTargetFiles = [
      'yarn.lock',
      'packages/tomatoes/yarn.lock',
      'packages/apples/package.json',
    ].map((p) => pathLib.resolve(yarnRoot, p));
    const unprocessedFiles = filterOutProcessedWorkspaces(
      yarnRoot,
      scannedProjects as any,
      allTargetFiles,
      'yarn.lock',
    );
    expect(unprocessedFiles).toEqual([]);
  });

  test('1 package.json (yarn) does not belong to a workspace', () => {
    const allTargetFiles = [
      'yarn.lock',
      'not-part-of-workspace-yarn/yarn.lock',
      'packages/apples/package.json',
    ].map((p) => pathLib.resolve(yarnRoot, p));
    const unprocessedFiles = filterOutProcessedWorkspaces(
      yarnRoot,
      scannedProjects as any,
      allTargetFiles,
      'yarn.lock',
    );
    expect(unprocessedFiles).toEqual(
      ['not-part-of-workspace-yarn/yarn.lock'].map((p) =>
        pathLib.resolve(yarnRoot, p),
      ),
    );
  });

  test('1 package.json (npm) does not belong to a workspace', () => {
    const allTargetFiles = [
      'yarn.lock',
      'not-part-of-workspace-yarn/yarn.lock',
      'packages/apples/package.json',
    ].map((p) => pathLib.resolve(yarnRoot, p));
    const unprocessedFiles = filterOutProcessedWorkspaces(
      yarnRoot,
      scannedProjects as any,
      allTargetFiles,
      'yarn.lock',
    );
    expect(unprocessedFiles).toEqual(
      ['not-part-of-workspace-yarn/yarn.lock'].map((p) =>
        pathLib.resolve(yarnRoot, p),
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
    ].map((p) => pathLib.resolve(yarnRoot, p));
    const unprocessedFiles = filterOutProcessedWorkspaces(
      yarnRoot,
      scannedProjects as any,
      allTargetFiles,
      'yarn.lock',
    );
    expect(unprocessedFiles.sort()).toEqual(
      [
        'not-part-of-workspace-yarn/yarn.lock',
        'requirements.txt',
        'not-part-of-workspace-yarn/Pipfile.lock',
        'packages/apples/Pipfile',
      ]
        .sort()
        .map((p) => pathLib.resolve(yarnRoot, p)),
    );
  });
});

describe('filterOutProcessedPnpmWorkspaces', () => {
  test('all package.json belong to the same workspace', () => {
    const allTargetFiles = [
      'pnpm-lock.yaml',
      'packages/tomatoes/package.json',
      'packages/apples/package.json',
    ];
    const unprocessedFiles = filterOutProcessedWorkspaces(
      pnpmRoot,
      scannedPnpmProjects as any,
      allTargetFiles,
      'pnpm-lock.yaml',
    );
    expect(unprocessedFiles).toEqual([]);
  });

  test('1 package.json (pnpm) does not belong to a workspace', () => {
    const allTargetFiles = [
      'pnpm-lock.yaml',
      'not-part-of-workspace-pnpm/pnpm-lock.yaml',
      'packages/apples/package.json',
    ].map((p) => pathLib.resolve(pnpmRoot, p));
    const unprocessedFiles = filterOutProcessedWorkspaces(
      pnpmRoot,
      scannedPnpmProjects as any,
      allTargetFiles,
      'pnpm-lock.yaml',
    );
    expect(unprocessedFiles).toEqual(
      ['not-part-of-workspace-pnpm/pnpm-lock.yaml'].map((p) =>
        pathLib.resolve(pnpmRoot, p),
      ),
    );
  });

  test('multiple mixed files do not belong to a workspace', () => {
    const allTargetFiles = [
      'requirements.txt',
      'not-part-of-workspace-pnpm/Pipfile.lock',
      'pnpm-lock.yaml',
      'not-part-of-workspace-pnpm/pnpm-lock.yaml',
      'packages/apples/package.json',
      'packages/apples/Pipfile',
    ].map((p) => pathLib.resolve(pnpmRoot, p));
    const unprocessedFiles = filterOutProcessedWorkspaces(
      pnpmRoot,
      scannedPnpmProjects as any,
      allTargetFiles,
      'pnpm-lock.yaml',
    );
    expect(unprocessedFiles.sort()).toEqual(
      [
        'not-part-of-workspace-pnpm/pnpm-lock.yaml',
        'requirements.txt',
        'not-part-of-workspace-pnpm/Pipfile.lock',
        'packages/apples/Pipfile',
      ]
        .sort()
        .map((p) => pathLib.resolve(pnpmRoot, p)),
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

const scannedPnpmProjects = [
  {
    packageManager: 'pnpm',
    targetFile: 'package.json',
    depGraph: {
      schemaVersion: '1.3.0',
      pkgManager: {
        name: 'pnpm',
      },
      pkgs: [
        {
          id: 'package.json@',
          info: {
            name: 'package.json',
          },
        },
        {
          id: 'node-fetch@2.7.0',
          info: {
            name: 'node-fetch',
            version: '2.7.0',
          },
        },
        {
          id: 'whatwg-url@5.0.0',
          info: {
            name: 'whatwg-url',
            version: '5.0.0',
          },
        },
        {
          id: 'tr46@0.0.3',
          info: {
            name: 'tr46',
            version: '0.0.3',
          },
        },
        {
          id: 'webidl-conversions@3.0.1',
          info: {
            name: 'webidl-conversions',
            version: '3.0.1',
          },
        },
      ],
      graph: {
        rootNodeId: 'root-node',
        nodes: [
          {
            nodeId: 'root-node',
            pkgId: 'package.json@',
            deps: [
              {
                nodeId: 'node-fetch@2.7.0',
              },
            ],
          },
          {
            nodeId: 'node-fetch@2.7.0',
            pkgId: 'node-fetch@2.7.0',
            deps: [
              {
                nodeId: 'whatwg-url@5.0.0',
              },
            ],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
          {
            nodeId: 'whatwg-url@5.0.0',
            pkgId: 'whatwg-url@5.0.0',
            deps: [
              {
                nodeId: 'tr46@0.0.3',
              },
              {
                nodeId: 'webidl-conversions@3.0.1',
              },
            ],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
          {
            nodeId: 'tr46@0.0.3',
            pkgId: 'tr46@0.0.3',
            deps: [],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
          {
            nodeId: 'webidl-conversions@3.0.1',
            pkgId: 'webidl-conversions@3.0.1',
            deps: [],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
        ],
      },
    },
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: 'v18.20.1',
    },
  },
  {
    packageManager: 'pnpm',
    targetFile: 'libs/apple-lib/package.json',
    depGraph: {
      schemaVersion: '1.3.0',
      pkgManager: {
        name: 'pnpm',
      },
      pkgs: [
        {
          id: 'apple-lib@1.0.0',
          info: {
            name: 'apple-lib',
            version: '1.0.0',
          },
        },
        {
          id: 'node-uuid@1.3.0',
          info: {
            name: 'node-uuid',
            version: '1.3.0',
          },
        },
      ],
      graph: {
        rootNodeId: 'root-node',
        nodes: [
          {
            nodeId: 'root-node',
            pkgId: 'apple-lib@1.0.0',
            deps: [
              {
                nodeId: 'node-uuid@1.3.0',
              },
            ],
          },
          {
            nodeId: 'node-uuid@1.3.0',
            pkgId: 'node-uuid@1.3.0',
            deps: [],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
        ],
      },
    },
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: 'v18.20.1',
    },
  },
  {
    packageManager: 'pnpm',
    targetFile: 'packages/apples/package.json',
    depGraph: {
      schemaVersion: '1.3.0',
      pkgManager: {
        name: 'pnpm',
      },
      pkgs: [
        {
          id: 'apples@1.0.0',
          info: {
            name: 'apples',
            version: '1.0.0',
          },
        },
        {
          id: 'node-uuid@1.3.0',
          info: {
            name: 'node-uuid',
            version: '1.3.0',
          },
        },
      ],
      graph: {
        rootNodeId: 'root-node',
        nodes: [
          {
            nodeId: 'root-node',
            pkgId: 'apples@1.0.0',
            deps: [
              {
                nodeId: 'node-uuid@1.3.0',
              },
            ],
          },
          {
            nodeId: 'node-uuid@1.3.0',
            pkgId: 'node-uuid@1.3.0',
            deps: [],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
        ],
      },
    },
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: 'v18.20.1',
    },
  },
  {
    packageManager: 'pnpm',
    targetFile: 'packages/tomatoes/package.json',
    depGraph: {
      schemaVersion: '1.3.0',
      pkgManager: {
        name: 'pnpm',
      },
      pkgs: [
        {
          id: 'tomatoes@1.0.0',
          info: {
            name: 'tomatoes',
            version: '1.0.0',
          },
        },
        {
          id: 'object-assign@4.1.1',
          info: {
            name: 'object-assign',
            version: '4.1.1',
          },
        },
        {
          id: 'node-fetch@2.7.0',
          info: {
            name: 'node-fetch',
            version: '2.7.0',
          },
        },
        {
          id: 'whatwg-url@5.0.0',
          info: {
            name: 'whatwg-url',
            version: '5.0.0',
          },
        },
        {
          id: 'tr46@0.0.3',
          info: {
            name: 'tr46',
            version: '0.0.3',
          },
        },
        {
          id: 'webidl-conversions@3.0.1',
          info: {
            name: 'webidl-conversions',
            version: '3.0.1',
          },
        },
      ],
      graph: {
        rootNodeId: 'root-node',
        nodes: [
          {
            nodeId: 'root-node',
            pkgId: 'tomatoes@1.0.0',
            deps: [
              {
                nodeId: 'object-assign@4.1.1',
              },
              {
                nodeId: 'node-fetch@2.7.0',
              },
            ],
          },
          {
            nodeId: 'object-assign@4.1.1',
            pkgId: 'object-assign@4.1.1',
            deps: [],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
          {
            nodeId: 'node-fetch@2.7.0',
            pkgId: 'node-fetch@2.7.0',
            deps: [
              {
                nodeId: 'whatwg-url@5.0.0',
              },
            ],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
          {
            nodeId: 'whatwg-url@5.0.0',
            pkgId: 'whatwg-url@5.0.0',
            deps: [
              {
                nodeId: 'tr46@0.0.3',
              },
              {
                nodeId: 'webidl-conversions@3.0.1',
              },
            ],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
          {
            nodeId: 'tr46@0.0.3',
            pkgId: 'tr46@0.0.3',
            deps: [],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
          {
            nodeId: 'webidl-conversions@3.0.1',
            pkgId: 'webidl-conversions@3.0.1',
            deps: [],
            info: {
              labels: {
                scope: 'prod',
              },
            },
          },
        ],
      },
    },
    plugin: {
      name: 'snyk-nodejs-lockfile-parser',
      runtime: 'v18.20.1',
    },
  },
];
