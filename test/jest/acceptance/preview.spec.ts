import { runSnykCLI } from '../util/runSnykCLI';

jest.setTimeout(1000 * 10);

describe('Enable preview features', () => {
  it('force enable', async () => {
    const { code, stdout } = await runSnykCLI(`woof --language=cat`, {
      env: { ...process.env, SNYK_PREVIEW: '1' },
    });
    expect(code).toBe(0);
    expect(stdout).toContain('This is a previewoof!');
  });

  it('force disable', async () => {
    const { code, stdout } = await runSnykCLI(`woof --language=cat`, {
      env: { ...process.env, SNYK_PREVIEW: '0' },
    });
    expect(code).toBe(0);
    expect(stdout).not.toContain('This is a previewoof!');
  });
});
