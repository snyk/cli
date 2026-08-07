import { runSnykCLI } from '../util/runSnykCLI';
import { startSnykCLI } from '../util/startSnykCLI';

jest.setTimeout(1000 * 120);

describe('snyk doctor', () => {
  const env = {
    ...process.env,
    SNYK_DISABLE_ANALYTICS: '1',
  };

  describe('use doctor on the current system (live checks)', () => {
    it('outputs a human readable report', async () => {
      const { code, stdout } = await runSnykCLI('doctor', {
        env,
      });
      expect(code).toBe(0);
      expect(stdout).toContain('Snyk Doctor Diagnostic Report');
    });
  });

  describe('use doctor on the debug logs of another system', () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    const sampleLog = [
      '2026-06-10T13:10:38Z main - < response [0x1]: 401 Unauthorized',
      '2026-06-10T13:10:38Z main - ------------ Summary ------------',
      '2026-06-10T13:10:38Z main - ------------ Errors ------------',
      '2026-06-10T13:10:38Z main - Authentication error (SNYK-0005)',
      '2026-06-10T13:10:38Z main - Exit Code:             2',
    ].join('\n');

    let logFile: string;
    let tmpDir: string;

    beforeEach(() => {
      tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'doctor-test-'));
      logFile = path.join(tmpDir, 'debug.log');
      fs.writeFileSync(logFile, sampleLog);
    });

    afterEach(() => {
      fs.rmSync(tmpDir, { recursive: true, force: true });
    });

    it('analyzes the debug log and reports findings', async () => {
      const { code, stdout } = await runSnykCLI(`doctor --input=${logFile}`, {
        env,
      });

      expect(code).toBe(0);
      expect(stdout).toContain('Snyk Doctor Diagnostic Report');
    });

    it('--input with non-existent file', async () => {
      const { code } = await runSnykCLI(
        'doctor --input=/tmp/does-not-exist-snyk-doctor-test.log',
        { env },
      );

      expect(code).not.toBe(0);
    });

    it('analyzes debug logs piped via --stdin', async () => {
      const cli = await startSnykCLI('doctor --stdin', { env });

      await cli.input(sampleLog);
      cli.process.stdin.end();

      await expect(cli).toDisplay('Snyk Doctor Diagnostic Report');
      await expect(cli).toExitWith(0);
    });
  });
});
