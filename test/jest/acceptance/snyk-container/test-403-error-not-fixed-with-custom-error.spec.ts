/**
 * Test demonstrating the bug where a 403 error from snyk container test
 * loses status code
 */

import { fakeServer } from '../../../acceptance/fake-server';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('snyk container test - 403 error handling bug', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = '12346';
    const baseApi = '/api/v1';
    env = {
      ...process.env,
      SNYK_API: 'http://localhost:' + port + baseApi,
      SNYK_HOST: 'http://localhost:' + port,
      SNYK_TOKEN: '123456789',
      SNYK_DISABLE_ANALYTICS: '1',
    };
    server = fakeServer(baseApi, env.SNYK_TOKEN);
    await new Promise<void>((resolve) => {
      server.listen(port, () => {
        resolve();
      });
    });
  });

  afterEach(() => {
    server.restore();
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      server.close(() => {
        resolve();
      });
    });
  });

  it("using CustomError instead of plain Error in /src/lib/ecosystems/test.ts doesn't fix the bug", async () => {
    // The error status code is "0" instead of "403"
    const fs = require('fs');
    const os = require('os');
    const path = require('path');

    const errorFilePath = path.join(
      os.tmpdir(),
      `snyk-error-test-${Date.now()}.json`,
    );

    server.setNextResponse({
      userMessage: 'This functionality is not available on your plan.',
    });
    server.setNextStatusCode(403);

    const envWithIPC = {
      ...env,
      SNYK_ERR_FILE: errorFilePath,
    };

    const { code } = await runSnykCLI(`container test alpine:latest`, {
      env: envWithIPC,
    });

    expect(code).toBeGreaterThan(0);

    let errorData;
    try {
      const errorContent = fs.readFileSync(errorFilePath, 'utf8');
      errorData = JSON.parse(errorContent);

      expect(errorData.errors).toBeDefined();
      expect(errorData.errors.length).toBeGreaterThan(0);

      const error = errorData.errors[0];

      expect(error.status).toBe('403'); // BUG: Original HTTP status (403) should be preserved but it is not and instead this is "0"

      // the below is expected
      expect(error.code).toBe('SNYK-CLI-0000'); // GeneralCLIFailureError code from factory
      expect(error.detail).toContain(
        'This functionality is not available on your plan.',
      ); // User message should be preserved
    } finally {
      if (fs.existsSync(errorFilePath)) {
        fs.unlinkSync(errorFilePath);
      }
    }
  });
});
