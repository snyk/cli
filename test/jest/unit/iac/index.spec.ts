jest.mock('../../../../src/cli/commands/test/iac/local-execution/local-cache');
jest.mock('../../../../src/cli/commands/test/iac/local-execution/file-loader');
const isFeatureFlagSupportedForOrgStub = jest.fn();
jest.mock('../../../../src/lib/feature-flags', () => ({
  isFeatureFlagSupportedForOrg: isFeatureFlagSupportedForOrgStub,
}));
const parseFilesStub = jest.fn();
jest.mock(
  '../../../../src/cli/commands/test/iac/local-execution/file-parser',
  () => {
    return {
      parseFiles: parseFilesStub,
    };
  },
);
jest.mock(
  '../../../../src/cli/commands/test/iac/local-execution/file-scanner',
  () => {
    return {
      scanFiles: async () => [],
    };
  },
);
jest.mock('../../../../src/lib/detect', () => ({
  isLocalFolder: () => true,
}));

const getIacOrgSettingsStub = jest.fn();
jest.mock(
  '../../../../src/cli/commands/test/iac/local-execution/org-settings/get-iac-org-settings.ts',
  () => ({
    getIacOrgSettings: getIacOrgSettingsStub,
  }),
);

const getAllDirectoriesForPathStub = jest.fn();
const getFilesForDirectoryStub = jest.fn();
jest.mock(
  '../../../../src/cli/commands/test/iac/local-execution/directory-loader',
  () => ({
    getAllDirectoriesForPath: getAllDirectoriesForPathStub,
    getFilesForDirectory: getFilesForDirectoryStub,
  }),
);

import { test } from '../../../../src/cli/commands/test/iac/local-execution/';
import * as measurableMethods from '../../../../src/cli/commands/test/iac/local-execution/measurable-methods';
import {
  IacFileParsed,
  IaCTestFlags,
} from '../../../../src/cli/commands/test/iac/local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';
import { EngineType } from '../../../../src/cli/commands/test/iac/local-execution/types';
const parsedFiles: IacFileParsed[] = [
  {
    engineType: EngineType.Terraform,
    fileContent: 'FAKE_FILE_CONTENT',
    jsonContent: {},
    filePath: './storage/storage.tf',
    fileType: 'tf',
    projectType: IacProjectType.TERRAFORM,
  },
];
const failedFiles: IacFileParsed[] = [
  {
    engineType: EngineType.Terraform,
    fileContent: 'FAKE_FILE_CONTENT',
    jsonContent: {},
    filePath: './storage/storage.tf',
    fileType: 'tf',
    failureReason: 'Mock Test',
    projectType: IacProjectType.TERRAFORM,
  },
];

describe('test()', () => {
  describe.each([
    [{ iacTerraformVarSupport: false }],
    [{ iacTerraformVarSupport: true }],
  ])('With TF language support feature flag set to %p', (featureFlags) => {
    beforeAll(() => {
      isFeatureFlagSupportedForOrgStub.mockImplementation((flag) =>
        Promise.resolve({ ok: featureFlags[flag] ?? true }),
      );
      getAllDirectoriesForPathStub.mockImplementation(() => ['./storage']);
      parseFilesStub.mockImplementation(() => ({
        parsedFiles,
        failedFiles,
      }));
    });

    describe('With a remote custom rules bundle', () => {
      let pullSpy: jest.SpyInstance;

      beforeAll(function() {
        getIacOrgSettingsStub.mockImplementation(async () => ({
          meta: {
            isPrivate: false,
            isLicensesEnabled: false,
            ignoreSettings: null,
            org: 'org-name',
          },
          customPolicies: {},
          customRules: {
            isEnabled: true,
            ociRegistryURL: 'https://fake-registry/lib/img',
            ociRegistryTag: 'latest',
          },
          entitlements: {
            infrastructureAsCode: true,
            iacCustomRulesEntitlement: true,
          },
        }));
        pullSpy = jest
          .spyOn(measurableMethods, 'pull')
          .mockImplementationOnce(async () => 'random-path');
      });

      afterEach(function() {
        pullSpy.mockClear();
      });

      afterAll(function() {
        pullSpy.mockReset();
      });

      it('attempts to pull the custom-rules bundle using the provided configurations', async () => {
        const opts: IaCTestFlags = {};

        await test('./iac/terraform/sg_open_ssh.tf', opts);

        expect(pullSpy).toBeCalledWith(
          {
            registryBase: 'fake-registry',
            repo: 'lib/img',
            tag: 'latest',
          },
          expect.anything(),
        );
      });
    });

    describe('Without a remote custom rules bundle', () => {
      beforeAll(function() {
        getIacOrgSettingsStub.mockImplementation(async () => ({
          meta: {
            isPrivate: false,
            isLicensesEnabled: false,
            ignoreSettings: null,
            org: 'org-name',
          },
          customPolicies: {},
          customRules: {},
          entitlements: {
            infrastructureAsCode: true,
            iacCustomRulesEntitlement: true,
          },
        }));
      });

      it('returns the unparsable files excluding content', async () => {
        const opts: IaCTestFlags = {};

        const { failures } = await test('./storage/', opts);

        expect(failures).toEqual([
          {
            filePath: './storage/storage.tf',
            fileType: 'tf',
            failureReason: 'Mock Test',
            projectType: IacProjectType.TERRAFORM,
          },
        ]);
        expect(failures).not.toEqual(
          expect.arrayContaining([
            {
              fileContent: 'FAKE_FILE_CONTENT',
              jsonContent: {},
            },
          ]),
        );
      });
    });
  });
});
