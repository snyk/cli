import { createProjectFromFixture } from '../../util/createProject';
import { runSnykCLI } from '../../util/runSnykCLI';
import { matchers } from 'jest-json-schema';
import * as path from 'path';

expect.extend(matchers);
jest.setTimeout(1000 * 120);

const EXIT_CODE_ACTION_NEEDED = 1;

describe('snyk sbom test --reachability', () => {
  it('works on projects with no git context', async () => {
    // createProjectFromFixture creates a new project without gitcontext
    const { path: tmpPth } = await createProjectFromFixture(
      'sast/shallow_sast_webgoat',
    );

    const { code, stderr } = await runSnykCLI(
      `sbom test --experimental --file=${path.join(tmpPth(), 'sbom.json')} --reachability --source-dir=${tmpPth()}`,
      {
        env: {
          ...process.env,
        },
      },
    );

    expect(stderr).toBe('');
    expect(code).toBe(EXIT_CODE_ACTION_NEEDED);
  });
});
