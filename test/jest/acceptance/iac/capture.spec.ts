import { startMockServer } from './helpers';
import * as fs from 'fs';
import * as path from 'path';
import { getFixturePath } from '../../util/getFixturePath';
import { isCLIV2 } from '../../util/isCLIV2';

jest.setTimeout(50000);

describe('iac capture', () => {
  let run: (
    cmd: string,
    env: Record<string, string>,
  ) => Promise<{ stdout: string; stderr: string; exitCode: number }>;
  let teardown: () => void;
  let apiUrl: string;

  beforeAll(async () => {
    ({ run, teardown, apiUrl } = await startMockServer());
  });

  afterAll(async () => teardown());

  it('capture fail when not used as an iac sub-command', async () => {
    const { stdout, stderr, exitCode } = await run(`snyk capture`, {});

    expect(stdout).toContain('Unknown command "capture"');
    expect(stderr).toMatch('');
    expect(exitCode).toBe(2);
  });

  if (!isCLIV2()) {
    return;
  }

  it('Launch capture without states', async () => {
    const { stdout, stderr, exitCode } = await run(
      `snyk iac capture ./iac/drift/`,
      {
        ...process.env,
        ORG: '0d9905be-7914-42c3-ada5-9c95d6fe7eb8',
        SNYK_API: apiUrl,
      },
    );

    expect(stdout).toContain(
      "could not find any Terraform state in './iac/drift/'",
    );
    expect(stderr).toMatch('');
    expect(exitCode).toBe(2);
  });

  it('Launch capture with a state success', async () => {
    const statePath = path.join(
      getFixturePath('iac'),
      'capture',
      'full.tfstate',
    );
    const orgId = '0d9905be-7914-42c3-ada5-9c95d6fe7eb8';

    const { stdout, stderr, exitCode } = await run(
      `snyk iac capture -d ${statePath}`,
      {
        ...process.env,
        ORG: orgId,
        SNYK_API: apiUrl,
      },
    );

    expect(stdout).toContain('Successfully captured all your states');
    expect(stdout).toContain(statePath);
    expect(stderr).toMatch('');
    expect(exitCode).toBe(0);

    const gotArtifact = path.join(
      getFixturePath('iac'),
      'capture',
      orgId + '-artifact.json',
    );
    const got = require(gotArtifact);

    const expArtifact = path.join(
      getFixturePath('iac'),
      'capture',
      'full-filtered.json',
    );
    const expected = require(expArtifact);

    expect(got).toMatchObject(expected);
    fs.rmSync(gotArtifact);
  });
});
