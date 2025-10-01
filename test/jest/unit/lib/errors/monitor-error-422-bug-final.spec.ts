/**
 * Test demonstrating the MonitorError bug where HTTP 422 errors
 * get transformed to SNYK-9999 with status 500
 * 
 * This test PASSES, proving the bug exists.
 */

import { MonitorError } from '../../../../../src/lib/errors/monitor-error';
import { CustomError } from '../../../../../src/lib/errors/custom-error';

describe('MonitorError 422 → SNYK-9999 Bug (DEMONSTRATES BUG)', () => {
  it('BUG: HTTP 422 creates MonitorError with SNYK-9999 and status 500', () => {
    // When registry returns 422
    const error = new MonitorError(422, 'Invalid scan result data');

    // ✅ The MonitorError instance DOES preserve the 422
    expect(error.code).toBe(422);
    expect(error.userMessage).toBe('Invalid scan result data');

    // ✅ errorCatalog exists and is a ServerError
    expect(error.errorCatalog).toBeDefined();
    const catalog: any = error.errorCatalog;
    expect(catalog.constructor.name).toBe('ServerError');

    // ❌ BUG: errorCatalog has WRONG status and error code
    expect(catalog.metadata.status).toBe(500); // Should be 422!
    expect(catalog.metadata.errorCode).toBe('SNYK-9999'); // Too generic!
    expect(catalog.detail).toBe('Invalid scan result data'); // Detail is correct

    console.log('\n🐛 BUG DEMONSTRATED:');
    console.log(`   Registry returned: HTTP 422`);
    console.log(`   MonitorError.code: ${error.code} ✅`);
    console.log(`   errorCatalog.metadata.status: ${catalog.metadata.status} ❌ (should be 422)`);
    console.log(`   errorCatalog.metadata.errorCode: ${catalog.metadata.errorCode} ❌ (should be specific)`);
  });

  it('BUG: All 4xx errors map to the same SNYK-9999 error', () => {
    const testCases = [
      { code: 400, message: 'Bad Request' },
      { code: 404, message: 'Not Found' },
      { code: 422, message: 'Unprocessable Entity' },
      { code: 429, message: 'Too Many Requests' },
    ];

    console.log('\n🐛 All different HTTP codes map to SNYK-9999:');
    
    testCases.forEach(({ code, message }) => {
      const error = new MonitorError(code, message);
      const catalog: any = error.errorCatalog;

      // All get the same error catalog
      expect(catalog.metadata.errorCode).toBe('SNYK-9999');
      expect(catalog.metadata.status).toBe(500);

      console.log(`   HTTP ${code} → SNYK-9999 (status: 500) ❌`);
    });
  });

  it('BUG: IPC layer replaces MonitorError with errorCatalog, losing the 422', () => {
    const error = new MonitorError(422, 'Validation failed');

    // This simulates what src/cli/ipc.ts lines 42-44 do:
    // if (err instanceof CustomError && err.errorCatalog) {
    //   err = err.errorCatalog;
    // }

    expect(error).toBeInstanceOf(CustomError); // ✅ TRUE
    expect(error.errorCatalog).toBeDefined(); // ✅ TRUE

    // So IPC replaces the error
    const replacedError: any = error.errorCatalog;

    console.log('\n🐛 IPC Transformation:');
    console.log(`   BEFORE: MonitorError.code = ${error.code}`);
    console.log(`   AFTER:  errorCatalog.metadata.status = ${replacedError.metadata.status}`);
    console.log(`   AFTER:  errorCatalog.metadata.errorCode = ${replacedError.metadata.errorCode}`);

    // The 422 is lost!
    expect(replacedError.metadata.status).toBe(500);
    expect(replacedError.metadata.errorCode).toBe('SNYK-9999');
    
    // This is the bug: user sees SNYK-9999 (500) instead of 422
  });

  it('shows what the toJsonApi() output looks like (what CLIv2 receives)', () => {
    const error = new MonitorError(422, 'Invalid scan result data');
    const catalog: any = error.errorCatalog;

    const jsonApi = catalog.toJsonApi();
    const body = jsonApi.body();

    console.log('\n📤 What CLIv2 receives:');
    console.log(JSON.stringify(body, null, 2));

    // Verify the bug is in the output
    expect(body.errors[0].status).toBe('500'); // Should be '422'!
    expect(body.errors[0].code).toBe('SNYK-9999'); // Too generic!
    expect(body.errors[0].detail).toBe('Invalid scan result data'); // This is preserved
  });
});

