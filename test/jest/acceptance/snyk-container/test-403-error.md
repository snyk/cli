
------------------------------------------------------------
 Environment successfully setup! Starting to run tests now!
------------------------------------------------------------
  console.log
    No Binary configured with TEST_SNYK_COMMAND, falling back to node

      at runSnykCLIWithArray (test/jest/util/runSnykCLI.ts:21:11)

  console.log
       Attempted Fix: Using CustomError instead of plain Error + copying errorCatalog property

      at Object.<anonymous> (test/jest/acceptance/snyk-container/test-403-error.spec.ts:84:15)

  console.log
       Status: "401" (HTTP status, should be "403")

      at Object.<anonymous> (test/jest/acceptance/snyk-container/test-403-error.spec.ts:85:15)

  console.log
       Code: "SNYK-0005" (error catalog code, should be "SNYK-CLI-0000")

      at Object.<anonymous> (test/jest/acceptance/snyk-container/test-403-error.spec.ts:86:15)

  console.log
       User message preserved: true

      at Object.<anonymous> (test/jest/acceptance/snyk-container/test-403-error.spec.ts:87:15)

 FAIL   coreCli  test/jest/acceptance/snyk-container/test-403-error.spec.ts
  snyk container test - 403 error handling bug
    ✕ FIXED: errorCatalog property and error status code are not properly preserved (1054 ms)

  ● snyk container test - 403 error handling bug › FIXED: errorCatalog property and error status code are not properly preserved

    expect(received).toBe(expected) // Object.is equality

    Expected: "403"
    Received: "401"

      88 |
      89 |       // NOT FULLY FIXED: The errorCatalog is not preserved with proper error codes AND original status
    > 90 |       expect(error.status).toBe('403');
         |                            ^
      91 |       expect(error.code).toBe('SNYK-CLI-0000');
      92 |       expect(error.detail).toContain('This functionality is not available on your plan.');      
      93 |       

      at Object.<anonymous> (test/jest/acceptance/snyk-container/test-403-error.spec.ts:90:28)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        1.263 s, estimated 2 s
Ran all test suites matching /test\/jest\/acceptance\/snyk-container\/test-403-error.spec.ts/i.