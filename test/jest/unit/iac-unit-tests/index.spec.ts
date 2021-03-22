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
        failureReason: 'Mock Test',
        projectType: IacProjectType.TERRAFORM,
      },
    ];
    return {
      parseFiles: async () => ({ parsedFiles, failedFiles: [] }),
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

import { test } from '../../../../src/cli/commands/test/iac-local-execution';
import {
  IacFileParsed,
  IaCTestFlags,
} from '../../../../src/cli/commands/test/iac-local-execution/types';
import { IacProjectType } from '../../../../src/lib/iac/constants';

describe('test()', () => {
  it('extends the options object with iacDirFiles when a local directory is provided', async () => {
    const opts: IaCTestFlags = {};
    const { files } = await test('./storage/', opts);

    expect(files).toEqual([
      {
        filePath: './storage/storage.tf',
        fileType: 'tf',
        failureReason: 'Mock Test',
        projectType: IacProjectType.TERRAFORM,
      },
    ]);
    expect(files).not.toEqual(
      expect.arrayContaining([
        {
          fileContent: 'FAKE_FILE_CONTENT',
          jsonContent: {},
        },
      ]),
    );
  });
});
