import { CLI } from '@snyk/error-catalog-nodejs-public';
import { sendError } from '../../../../src/cli/ipc';
import { tmpdir } from 'os';
import { ExcludeFlagBadInputError } from '../../../../src/lib/errors';

describe('sendError()', () => {
  const backupEnv = { ...process.env };
  afterEach(() => {
    process.env = { ...backupEnv };
  });

  describe('returns true', () => {
    beforeEach(() => {
      process.env.SNYK_ERR_FILE = tmpdir() + '/tmp_err_file.txt';
    });

    it('when given a simple error', async () => {
      const error = new Error('something went wrong');
      expect(await sendError(error, false)).toBeTruthy();
    });

    it('when given an Error Catalog error', async () => {
      const error = new CLI.GeneralCLIFailureError('something went wrong');
      expect(await sendError(error, false)).toBeTruthy();
    });

    it('when given an TS custom error', async () => {
      const error = new ExcludeFlagBadInputError();
      expect(await sendError(error, false)).toBeTruthy();
    });

    describe('JSON formatted errors', () => {
      const JSONerr = {
        ok: false,
        code: 1234,
        error: 'err in a list',
        path: 'somewhere/file',
      };

      it('when given a single error', async () => {
        const error = new Error(JSON.stringify(JSONerr));
        expect(await sendError(error, true)).toBeTruthy();
      });

      it('when given an error in a list', async () => {
        const errMsg = [
          {
            meta: {
              isPrivate: true,
              isLicensesEnabled: false,
              ignoreSettings: {
                adminOnly: false,
                reasonRequired: false,
                disregardFilesystemIgnores: false,
                autoApproveIgnores: false,
              },
              org: 'ORG',
              orgPublicId: 'ORGID',
              policy: '',
            },
            filesystemPolicy: false,
            vulnerabilities: [],
            dependencyCount: 0,
            licensesPolicy: null,
            ignoreSettings: null,
            targetFile: 'var_deref/nested_var_deref/variables.tf',
            projectName: 'badProject',
            org: 'ORG',
            policy: '',
            isPrivate: true,
            targetFilePath:
              '/a/valid/path/fixtures/iac/terraform/var_deref/nested_var_deref/variables.tf',
            packageManager: 'terraformconfig',
            path: './path/fixtures/iac/terraform',
            projectType: 'terraformconfig',
            ok: true,
            infrastructureAsCodeIssues: [],
          },
          JSONerr,
        ];
        const error = new Error(JSON.stringify(errMsg));
        expect(await sendError(error, true)).toBeTruthy();
      });
    });
  });

  describe('returns false', () => {
    it('when no error file path is specified', async () => {
      const error = new Error('something went wrong');
      expect(await sendError(error, false)).toBeFalsy();
    });

    it('when no error message is specified', async () => {
      const error = new Error('');
      expect(await sendError(error, false)).toBeFalsy();
    });

    it('when the file cannot be written', async () => {
      process.env.SNYK_ERR_FILE = './does/not/exist';
      const error = new Error('something went wrong');
      expect(await sendError(error, false)).toBeFalsy();
    });
  });
});
