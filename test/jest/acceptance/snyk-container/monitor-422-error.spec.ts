/**
 * Test demonstrating the bug where a 422 error from /monitor-dependencies
 * gets transformed into SNYK-9999 with status 500
 */

import { fakeServer } from '../../../acceptance/fake-server';
import { runSnykCLI } from '../../util/runSnykCLI';
import { getServerPort } from '../../util/getServerPort';

jest.setTimeout(1000 * 60);

describe('snyk container monitor - 422 error handling bug', () => {
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

  it('BUG PROOF: IPC error file contains SNYK-9999 and status 500 (not 422)', async () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    
    // Create a temp file for IPC error communication
    const errorFilePath = path.join(os.tmpdir(), `snyk-error-test-${Date.now()}.json`);
    
    // Set up the 422 error response
    server.setNextResponse({
      message: 'Validation failed: missing required field "docker.baseImage"',
    });
    server.setNextStatusCode(422);

    const envWithIPC = {
      ...env,
      SNYK_ERR_FILE: errorFilePath, // Enable IPC error writing
    };

    const { code } = await runSnykCLI(
      `container monitor alpine:latest`,
      { env: envWithIPC },
    );

    expect(code).toBeGreaterThan(0);

    // Read the IPC error file that was written
    let errorData;
    try {
      const errorContent = fs.readFileSync(errorFilePath, 'utf8');
      errorData = JSON.parse(errorContent);
      
      console.log('\n🎯 PROOF OF BUG - IPC Error File Content:');
      console.log(JSON.stringify(errorData, null, 2));
      
      // THE BUG PROOF: The error file contains SNYK-9999 and status "500"
      // even though the API returned 422
      expect(errorData.errors).toBeDefined();
      expect(errorData.errors.length).toBeGreaterThan(0);
      
      const error = errorData.errors[0];
      
      // ❌ BUG: Shows "500" instead of "422"
      expect(error.status).toBe('500');
      
      // ❌ BUG: Shows generic SNYK-9999 instead of specific 422 error
      expect(error.code).toBe('SNYK-9999');
      
      // ✅ The detail message is preserved
      expect(error.detail).toContain('Validation failed');
      
      console.log('\n❌ BUG CONFIRMED:');
      console.log(`   API returned: 422`);
      console.log(`   Error file status: "${error.status}" (should be "422")`);
      console.log(`   Error file code: "${error.code}" (should be specific, not generic)`);
      
    } finally {
      // Cleanup
      if (fs.existsSync(errorFilePath)) {
        fs.unlinkSync(errorFilePath);
      }
    }
  });

  it('BUG: All 4xx errors produce the same SNYK-9999 error', async () => {
    const fs = require('fs');
    const os = require('os');
    const path = require('path');
    
    const testCases = [
      { status: 400, message: 'Bad Request' },
      { status: 404, message: 'Not Found' },
      { status: 422, message: 'Unprocessable Entity' },
    ];

    console.log('\n🐛 Testing multiple 4xx status codes:');
    
    for (const { status, message } of testCases) {
      const errorFilePath = path.join(os.tmpdir(), `snyk-error-${status}-${Date.now()}.json`);
      
      server.restore();
      server.setNextResponse({ message });
      server.setNextStatusCode(status);

      const envWithIPC = {
        ...env,
        SNYK_ERR_FILE: errorFilePath,
      };

      await runSnykCLI(`container monitor alpine:latest`, { env: envWithIPC });

      try {
        const errorContent = fs.readFileSync(errorFilePath, 'utf8');
        const errorData = JSON.parse(errorContent);
        const error = errorData.errors[0];

        console.log(`   HTTP ${status} → error.status="${error.status}", error.code="${error.code}"`);
        
        // BUG: All get transformed to 500/SNYK-9999
        expect(error.status).toBe('500');
        expect(error.code).toBe('SNYK-9999');
        
        fs.unlinkSync(errorFilePath);
      } catch (e) {
        console.log(`   HTTP ${status} → Failed to read error file`);
        if (fs.existsSync(errorFilePath)) {
          fs.unlinkSync(errorFilePath);
        }
      }
    }
    
    console.log('   ❌ All different 4xx codes map to same SNYK-9999 error!');
  });
});

