import fse from 'fs-extra';
import path from 'path';
import { fetchPatches, getAllPatches } from '../../src/lib/fetch-patches';
import { VulnPatches } from '../../src/lib/types';

const getExpectedPatchDiff = (): Promise<string> => {
  const patchedLodashPath = path.resolve(
    __dirname,
    '../fixtures/patchable-file-lodash/lodash.patch',
  );
  return fse.readFile(patchedLodashPath, 'utf-8');
};

jest.setTimeout(1000 * 60);

describe('fetchPatches', () => {
  it('can fetch patches for valid request params', async () => {
    const expectedLodashPatch = await getExpectedPatchDiff();
    await expect(
      fetchPatches('SNYK-JS-LODASH-567746', 'lodash', '4.17.15'),
    ).resolves.toEqual([
      {
        patchableVersions: '>=4.14.2',
        patchDiffs: [expectedLodashPatch],
      },
    ]);
  });

  it('throws when version not valid semver', async () => {
    await expect(
      fetchPatches('SNYK-JS-LODASH-567746', 'lodash', 'not-valid-semver'),
    ).rejects.toThrow('version is not a valid semver');
  });

  it('throws when vulnId is not found', async () => {
    await expect(
      fetchPatches('no-such-vuln-id', 'lodash', '1.2.3'),
    ).rejects.toThrow('vulnId not found');
  });

  it('returns empty array when no patches found for vuln/version', async () => {
    await expect(
      fetchPatches('SNYK-JS-SSRI-1246392', 'ssri', '5.2.3'),
    ).resolves.toEqual([]);
  });
});

describe('getAllPatches', () => {
  it('works for normal scenario', async () => {
    const vulnIdAndPackageNames = [
      {
        vulnId: 'SNYK-JS-LODASH-567746',
        packageName: 'lodash',
      },
    ];

    const packageNameToVersionsMap = new Map<string, string[]>();
    packageNameToVersionsMap.set('lodash', ['4.17.15', '4.17.17']);
    const allPatchesMap = await getAllPatches(
      vulnIdAndPackageNames,
      packageNameToVersionsMap,
    );

    const expected = new Map<string, VulnPatches[]>();
    expected.set('lodash@4.17.15', [
      {
        vulnId: 'SNYK-JS-LODASH-567746',
        patches: [
          {
            patchableVersions: '>=4.14.2',
            patchDiffs: [
              getExpectedPatch(
                'lodash_0_0_20200430_6baae67d501e4c45021280876d42efe351e77551',
              ),
            ],
          },
        ],
      },
    ]);
    expected.set('lodash@4.17.17', [
      {
        vulnId: 'SNYK-JS-LODASH-567746',
        patches: [],
      },
    ]);

    expect(allPatchesMap).toEqual(expected);
  });

  it('works when no patches available', async () => {
    const vulnIdAndPackageNames = [
      {
        vulnId: 'SNYK-JS-LODASH-567746',
        packageName: 'lodash',
      },
    ];

    const packageNameToVersionsMap = new Map<string, string[]>();
    packageNameToVersionsMap.set('lodash', ['99.99.99']); // no patch for this version
    const allPatchesMap = await getAllPatches(
      vulnIdAndPackageNames,
      packageNameToVersionsMap,
    );

    const expected = new Map<string, VulnPatches[]>();
    expected.set('lodash@99.99.99', [
      {
        vulnId: 'SNYK-JS-LODASH-567746',
        patches: [],
      },
    ]);

    expect(allPatchesMap).toEqual(expected);
  });

  it('throws when a vulnId is not found', async () => {
    const vulnIdAndPackageNames = [
      {
        vulnId: 'SNYK-JS-LODASH-567746',
        packageName: 'lodash',
      },
      {
        vulnId: 'SNYK-JS-VULN_ID_DOES_NOT_EXIST',
        packageName: 'highsmash',
      },
    ];

    const packageNameToVersionsMap = new Map<string, string[]>();
    packageNameToVersionsMap.set('lodash', ['4.17.15']);
    packageNameToVersionsMap.set('highsmash', ['1.2.3']);

    await expect(
      // currently this throws
      // even if there's just one vulnId that is not found it will throw... is that what we want?
      getAllPatches(vulnIdAndPackageNames, packageNameToVersionsMap),
    ).rejects.toThrow('vulnId not found');
  });

  it('works when for vuln that has multiple applicable patches and more than one diff per patch', async () => {
    // this is a contrived example designed to test theoretically possible but never-gonna-happen scenario.
    const httpModule = require('../../src/lib/http');

    const mockApiResponse = {
      packageName: 'lodash',
      vulnerableVersions: ['<4.17.16'],
      patches: [
        {
          patchableVersions: '>=4.14.2',
          urls: [
            'https://snyk-patches.s3.amazonaws.com/npm/lodash/20200430/lodash_0_0_20200430_6baae67d501e4c45021280876d42efe351e77551.patch',
            'https://snyk-patches.s3.amazonaws.com/npm/lodash/20190702/lodash_20190702_0_0_1f8ea07746963a535385a5befc19fa687a627d2b.patch',
          ],
        },
        {
          patchableVersions: '>=4.15.1',
          urls: [
            'https://snyk-patches.s3.amazonaws.com/npm/lodash/20180130/20180130_0_0_lodash_d8e069cc3410082e44eb18fcf8e7f3d08ebe1d4a.patch',
            'https://snyk-patches.s3.amazonaws.com/npm/axios/20190424/axios_20190424_0_0_79a1ed204f4c2971b573edde816b3a43b25240da.patch', // yes this is for axios and makes no sense - it's a contrived scenario
          ],
        },
      ],
    };

    const requestSpy = jest.spyOn(httpModule, 'request');
    requestSpy.mockResolvedValueOnce({
      res: {
        statusCode: 200,
      },
      body: JSON.stringify(mockApiResponse),
    });

    const vulnIdAndPackageNames = [
      {
        vulnId: 'SNYK-JS-LODASH-567746',
        packageName: 'lodash',
      },
    ];
    const packageNameToVersionsMap = new Map<string, string[]>();
    packageNameToVersionsMap.set('lodash', ['4.17.15']);

    const allPatchesMap = await getAllPatches(
      vulnIdAndPackageNames,
      packageNameToVersionsMap,
    );

    const expected = new Map<string, VulnPatches[]>();
    expected.set('lodash@4.17.15', [
      {
        vulnId: 'SNYK-JS-LODASH-567746',
        patches: [
          {
            patchableVersions: '>=4.14.2',
            patchDiffs: [
              getExpectedPatch(
                'lodash_0_0_20200430_6baae67d501e4c45021280876d42efe351e77551',
              ),
              getExpectedPatch(
                'lodash_20190702_0_0_1f8ea07746963a535385a5befc19fa687a627d2b',
              ),
            ],
          },
          {
            patchableVersions: '>=4.15.1',
            patchDiffs: [
              getExpectedPatch(
                '20180130_0_0_lodash_d8e069cc3410082e44eb18fcf8e7f3d08ebe1d4a',
              ),
              getExpectedPatch(
                'axios_20190424_0_0_79a1ed204f4c2971b573edde816b3a43b25240da',
              ),
            ],
          },
        ],
      },
    ]);
    expect(allPatchesMap).toEqual(expected);
  });
});

function getExpectedPatch(patchId: string): string {
  const patchPath = path.resolve(
    __dirname,
    '../fixtures',
    'patches',
    `${patchId}.patch`,
  );
  return fse.readFileSync(patchPath, 'utf-8');
}
