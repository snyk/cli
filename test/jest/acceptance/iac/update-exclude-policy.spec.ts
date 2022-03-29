import { run as Run, startMockServer } from './helpers';
import * as os from 'os';
import * as fs from 'fs';
import * as rimraf from 'rimraf';
import * as path from 'path';
import { findAndLoadPolicy } from '../../../../src/lib/policy';

jest.setTimeout(50000);

describe('iac update-exclude-policy', () => {
  let run: typeof Run;
  let teardown: () => void;

  let tmpFolderPath: string;
  beforeEach(() => {
    tmpFolderPath = fs.mkdtempSync(path.join(os.tmpdir(), 'dctl-'));
  });
  afterEach(() => {
    rimraf.sync(tmpFolderPath);
  });

  beforeAll(async () => {
    ({ run, teardown } = await startMockServer());
  });

  afterAll(async () => teardown());

  it('update-exclude-policy fail without the right entitlement', async () => {
    const { stdout, stderr, exitCode } = await run(
      `snyk iac update-exclude-policy --org=no-iac-drift-entitlements`,
      {},
    );

    expect(stdout).toMatch(
      'Command "update-exclude-policy" is currently not supported for this org. To enable it, please contact snyk support.',
    );
    expect(stderr).toMatch('');
    expect(exitCode).toBe(2);
  });

  if (os.platform() === 'win32') {
    return; // skip following tests
  }

  it('update-exclude-policy successfully executed when org has the entitlement', async () => {
    const analysisPath = path.join(
      __dirname,
      '../../../fixtures/iac/drift/analysis.json',
    );

    const snykBinaryPath = path.join(__dirname, '../../../../bin/snyk');

    const { stderr, stdout, exitCode } = await run(
      `cat ${analysisPath} | ${snykBinaryPath} iac update-exclude-policy`,
      {},
      tmpFolderPath,
    );

    const policy = await findAndLoadPolicy(tmpFolderPath, 'iac', {});
    const expectedExcludes = {
      'iac-drift': [
        'aws_iam_access_key.AKIA5QYBVVD25KFXJHYJ',
        'aws_iam_user.test-driftctl2',
        'aws_iam_access_key.AKIA5QYBVVD2Y6PBAAPY',
        'aws_s3_bucket_policy.driftctl',
        'aws_s3_bucket_notification.driftctl',
      ],
    };

    expect(stdout).toBe('');
    expect(stderr).toMatch('');
    expect(exitCode).toBe(0);
    expect(policy).toBeDefined();
    expect(policy?.exclude).toStrictEqual(expectedExcludes);
  });
});
