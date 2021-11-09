jest.mock('../../../../src/cli/commands/test/iac-local-execution/local-cache');
jest.mock('../../../../src/cli/commands/test/iac-local-execution/file-loader');
jest.mock('../../../../src/lib/feature-flags', () => ({
  isFeatureFlagSupportedForOrg: async () => ({
    ok: true,
  }),
}));
jest.mock(
  '../../../../src/cli/commands/test/iac-local-execution/file-parser',
  () => {
    const { IacProjectType } = require('../../../../src/lib/iac/constants');
    const {
      EngineType,
    } = require('../../../../src/cli/commands/test/iac-local-execution/types');
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
    return {
      parseFiles: async () => ({ parsedFiles, failedFiles }),
    };
  },
);
jest.mock(
  '../../../../src/cli/commands/test/iac-local-execution/file-scanner',
  () => {
    return {
      scanFiles: async () => [],
    };
  },
);
jest.mock('../../../../src/lib/detect', () => ({
  isLocalFolder: () => true,
}));

jest.mock(
  '../../../../src/cli/commands/test/iac-local-execution/org-settings/get-iac-org-settings.ts',
  () => ({
    getIacOrgSettings: async () => ({
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
        iacCustomRulesEntitlement: true,
      },
    }),
  }),
);

import { test } from '../../../../src/cli/commands/test/iac-local-execution';
import * as measurableMethods from '../../../../src/cli/commands/test/iac-local-execution/measurable-methods';
import {
  IacFileParsed,
  IaCTestFlags,
} from '../../../../src/cli/commands/test/iac-local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';

describe('test()', () => {
  describe('Given an OCI registry configurations is provided in the IaC org settings', function() {
    let pullSpy: jest.SpyInstance;

    beforeAll(function() {
      pullSpy = jest
        .spyOn(measurableMethods, 'pull')
        .mockImplementationOnce(async () => {});
    });

    afterEach(function() {
      pullSpy.mockClear();
    });

    afterAll(function() {
      pullSpy.mockReset();
    });

    it('attemps to pull the custom-rules bundle using the provided configurations', async () => {
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
