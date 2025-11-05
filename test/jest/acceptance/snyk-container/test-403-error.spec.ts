/**
 * Test demonstrating the bug where a 403 error from /test-dependencies
 * loses status code and becomes SNYK-9999 with status 500
 */

import { fakeServer } from '../../../acceptance/fake-server';
import { runSnykCLI } from '../../util/runSnykCLI';

jest.setTimeout(1000 * 60);

describe('snyk container test - 403 error handling bug', () => {
  let server: ReturnType<typeof fakeServer>;
  let env: Record<string, string>;

  beforeAll(async () => {
    const port = '12346'; // Use a different port to avoid conflicts with other tests
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

  it('FIXED: errorCatalog property and error status code are properly preserved', async () => {
    // This test shows that the error status code is 403 and the error catalog code is SNYK-CLI-0000
    // when using CustomError instead of plain Error in /src/cli/commands/test/index.ts
    // and copying the errorCatalog property from the original error to the new error
    // and using createErrorCatalogFromStatusCode in the AuthFailedError function for 403 status codes
    
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    
    const errorFilePath = path.join(os.tmpdir(), `snyk-error-test-${Date.now()}.json`);
    
    server.setNextResponse({
      userMessage: 'This functionality is not available on your plan.',
    });
    server.setNextStatusCode(403);

    const envWithIPC = {
      ...env,
      SNYK_ERR_FILE: errorFilePath,
    };

    const { code } = await runSnykCLI(
      `container test alpine:latest`,
      { env: envWithIPC },
    );

    expect(code).toBeGreaterThan(0);

    // Read the IPC error file that was written
    let errorData;
    try {
      const errorContent = fs.readFileSync(errorFilePath, 'utf8');
      errorData = JSON.parse(errorContent);
      
      expect(errorData.errors).toBeDefined();
      expect(errorData.errors.length).toBeGreaterThan(0);
      
      const error = errorData.errors[0];
      
      console.log(`   Fix: Using CustomError instead of plain Error + copying errorCatalog property + createErrorCatalogFromStatusCode for 403 status codes`);
      console.log(`   Status: "${error.status}" (HTTP status, should be "403")`);
      console.log(`   Code: "${error.code}" (error catalog code, should be "SNYK-CLI-0000")`);
      console.log(`   User message preserved: ${error.detail.includes('This functionality is not available on your plan.')}`);

      // NOT FULLY FIXED: The errorCatalog is not preserved with proper error codes AND original status
      expect(error.status).toBe('403');
      expect(error.code).toBe('SNYK-CLI-0000');
      expect(error.detail).toContain('This functionality is not available on your plan.');      
      
    } finally {
      if (fs.existsSync(errorFilePath)) {
        fs.unlinkSync(errorFilePath);
      }
    }
  });
});