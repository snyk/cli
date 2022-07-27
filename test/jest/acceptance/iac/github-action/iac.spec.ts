import * as path from 'path';

import { GithubActionTestRunner } from './runner';

jest.setTimeout(50000);

describe('GitHub action - IaC', () => {
  describe.each([
    {
      relativeDir: '',
      inputPath: path.resolve(
        './test/fixtures',
        './iac/kubernetes/pod-valid.json',
      ), // absolute location to file
    },
    {
      relativeDir: '',
      inputPath: './iac/kubernetes/pod-valid.json', // a file
    },
    {
      relativeDir: '',
      inputPath: './iac', // one folder down
    },
    {
      relativeDir: 'iac',
      inputPath: '.', // current directory provided as .
    },
    {
      relativeDir: 'iac',
      inputPath: '', // current directory provided by default
    },
  ])('when provided config: %j', ({ relativeDir, inputPath }) => {
    let githubActionTestRunner: GithubActionTestRunner;

    beforeAll(async () => {
      githubActionTestRunner = await GithubActionTestRunner.build(
        'iac',
        relativeDir,
        inputPath,
      );
    });

    afterAll(async () => {
      githubActionTestRunner.destroy();
    });

    it(`tests the GH Action SARIF output`, async () => {
      await githubActionTestRunner.test();
    });
  });
});
