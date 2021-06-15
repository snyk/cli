import { Options } from '../../../../../src/lib/types';
import * as polling from '../../../../../src/lib/ecosystems/polling';
import { resolveAndTestFacts } from '../../../../../src/lib/ecosystems/test';

describe('test ecosystems', () => {
  it('resolveAndTestFacts', async () => {
    /* eslint-disable @typescript-eslint/camelcase */
    const scanResults = {
      path: [
        {
          name: 'my-unmanaged-c-project',
          facts: [
            {
              type: 'fileSignatures',
              data: [
                {
                  path: 'fastlz_example/fastlz.h',
                  hashes_ffm: [
                    {
                      format: 1,
                      data: 'ucMc383nMM/wkFRM4iOo5Q',
                    },
                    {
                      format: 1,
                      data: 'k+DxEmslFQWuJsZFXvSoYw',
                    },
                  ],
                },
              ],
            },
          ],
          identity: {
            type: 'cpp',
          },
          target: {
            remoteUrl: 'https://github.com/some-org/some-unmanaged-project.git',
            branch: 'master',
          },
        },
      ],
    };

    const depGraphData = {
      schemaVersion: '1.2.0',
      pkgManager: { name: 'cpp' },
      pkgs: [
        { id: '_root@0.0.0', info: { name: '_root', version: '0.0.0' } },
        {
          id: 'fastlz|https://github.com/ariya/fastlz/archive/0.5.0.zip@0.5.0',
          info: {
            name: 'fastlz|https://github.com/ariya/fastlz/archive/0.5.0.zip',
            version: '0.5.0',
          },
        },
      ],
      graph: {
        rootNodeId: 'root-node',
        nodes: [
          {
            nodeId: 'root-node',
            pkgId: '_root@0.0.0',
            deps: [
              {
                nodeId:
                  'fastlz|https://github.com/ariya/fastlz/archive/0.5.0.zip@0.5.0',
              },
            ],
          },
          {
            nodeId:
              'fastlz|https://github.com/ariya/fastlz/archive/0.5.0.zip@0.5.0',
            pkgId:
              'fastlz|https://github.com/ariya/fastlz/archive/0.5.0.zip@0.5.0',
            deps: [],
          },
        ],
      },
    };

    // temporary values, we trully want depGraph & issuesData/affectedPkgs
    const pollingWithTokenUntilDoneSpy = jest.spyOn(
      polling,
      'pollingWithTokenUntilDone',
    );

    pollingWithTokenUntilDoneSpy.mockResolvedValueOnce({
      result: {
        issuesData: {},
        issues: [],
        depGraphData,
        meta: {
          isPrivate: true,
          isLicensesEnabled: false,
          ignoreSettings: null,
          org: expect.any(String),
        },
      },
    });

    const [testResults, errors] = await resolveAndTestFacts(
      'cpp',
      scanResults,
      {} as Options,
    );

    expect(testResults).toEqual([
      {
        result: {
          issuesData: {},
          issues: [],
          depGraphData,
          meta: {
            isPrivate: true,
            isLicensesEnabled: false,
            ignoreSettings: null,
            org: expect.any(String),
          },
        },
      },
    ]);
    expect(errors).toEqual([]);
  });
});
