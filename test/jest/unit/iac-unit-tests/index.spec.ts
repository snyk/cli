jest.mock('../../../../src/cli/commands/test/iac-local-execution/local-cache');
jest.mock('../../../../src/cli/commands/test/iac-local-execution/file-loader');
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
      customRules: {},
    }),
  }),
);

import { test } from '../../../../src/cli/commands/test/iac-local-execution';
import {
  IacFileParsed,
  IaCTestFlags,
} from '../../../../src/cli/commands/test/iac-local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';

describe('test()', () => {
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
