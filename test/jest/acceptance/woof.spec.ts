import { runSnykCLI } from '../util/runSnykCLI';

describe('woof', () => {
  it('Woofs in English by default', async () => {
    const { stdout, code, stderr } = await runSnykCLI(`woof`);

    expect(stdout).toContain('Woof!');
    expect(code).toBe(0);
    expect(stderr).toBe('');
  });

  it('Woofs in English when passed unsupported language', async () => {
    const { stdout, stderr, code } = await runSnykCLI(
      `woof --language=blalbla`,
    );

    expect(stdout).toContain('Woof!');
    expect(code).toBe(0);
    expect(stderr).toBe('');
  });

  it('Woofs in Czech when passed "cs"', async () => {
    const { stdout, code, stderr } = await runSnykCLI(`woof --language=cs`);

    expect(stdout).toContain('Haf!');
    expect(code).toBe(0);
    expect(stderr).toBe('');
  });
});
