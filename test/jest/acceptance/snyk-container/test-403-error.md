------------------------------------------------------------
 Environment successfully setup! Starting to run tests now!
------------------------------------------------------------
  console.log
    No Binary configured with TEST_SNYK_COMMAND, falling back to node

      at runSnykCLIWithArray (test/jest/util/runSnykCLI.ts:21:11)

  console.log
       Fix: Using CustomError instead of plain Error + copying errorCatalog property + createErrorCatalogFromStatusCode for 403 status codes

      at Object.<anonymous> (test/jest/acceptance/snyk-container/test-403-error.spec.ts:85:15)

  console.log
       Status: "403" (HTTP status, should be "403")

      at Object.<anonymous> (test/jest/acceptance/snyk-container/test-403-error.spec.ts:86:15)

  console.log
       Code: "SNYK-CLI-0000" (error catalog code, should be "SNYK-CLI-0000")

      at Object.<anonymous> (test/jest/acceptance/snyk-container/test-403-error.spec.ts:87:15)

  console.log
       User message preserved: true

      at Object.<anonymous> (test/jest/acceptance/snyk-container/test-403-error.spec.ts:88:15)

 PASS   coreCli  test/jest/acceptance/snyk-container/test-403-error.spec.ts
  snyk container test - 403 error handling bug
    ✓ FIXED: errorCatalog property and error status code are properly preserved (1077 ms)

Test Suites: 1 passed, 1 total
Tests:       1 passed, 1 total
Snapshots:   0 total
Time:        1.364 s, estimated 2 s
Ran all test suites matching /test\/jest\/acceptance\/snyk-container\/test-403-error.spec.ts/i.