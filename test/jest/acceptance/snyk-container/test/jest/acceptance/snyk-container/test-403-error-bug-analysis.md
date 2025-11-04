skorandla@L32X2M7N46 cli % npx jest /Users/skorandla/Desktop/workspace/cli/test/jest/acceptance/snyk-container/test-403-error-not-fixed-with-custom-error.spec.ts --verbose
Determining test suites to run...No Binary configured with TEST_SNYK_COMMAND, falling back to node

------------------------------------------------------------------------------------------------------
 Binary under test   [TEST_SNYK_COMMAND] .............. undefined
 Version under test  .................................. 1.0.0-monorepo
 Allow to skip tests [TEST_SNYK_DONT_SKIP_ANYTHING] ... true
 Run FIPS tests      [TEST_SNYK_FIPS] ................. false
 Organization        [TEST_SNYK_ORG_SLUGNAME] ......... team-cli-testing
 Token               [TEST_SNYK_TOKEN] ................ UNSET
 API                 [TEST_SNYK_API] .................. https://api.snyk.io
------------------------------------------------------------------------------------------------------

------------------------------------------------------------
 Currently Tests require the environment variable TEST_SNYK_TOKEN to be set.
 This token is automatically stored on the config as some tests require this.
------------------------------------------------------------

------------------------------------------------------------
 Environment successfully setup! Starting to run tests now!
------------------------------------------------------------
  console.log
    No Binary configured with TEST_SNYK_COMMAND, falling back to node

      at runSnykCLIWithArray (test/jest/util/runSnykCLI.ts:21:11)

 FAIL   coreCli  test/jest/acceptance/snyk-container/test-403-error-not-fixed-with-custom-error.spec.ts
  snyk container test - 403 error handling bug
    ✕ using CustomError instead of plain Error in /src/lib/ecosystems/test.ts doesn't fix the bug (1149 ms)

  ● snyk container test - 403 error handling bug › using CustomError instead of plain Error in /src/lib/ecosystems/test.ts doesn't fix the bug

    expect(received).toBe(expected) // Object.is equality

    Expected: "403"
    Received: "0"

      78 |       const error = errorData.errors[0];
      79 |       
    > 80 |       expect(error.status).toBe('403'); // BUG: Original HTTP status (403) should be preserved but it is not and instead this is "0"
         |                            ^
      81 |
      82 |       // the below is expected
      83 |       expect(error.code).toBe('SNYK-CLI-0000'); // GeneralCLIFailureError code from factory

      at Object.<anonymous> (test/jest/acceptance/snyk-container/test-403-error-not-fixed-with-custom-error.spec.ts:80:28)

Test Suites: 1 failed, 1 total
Tests:       1 failed, 1 total
Snapshots:   0 total
Time:        1.355 s, estimated 2 s
Ran all test suites matching /\/Users\/skorandla\/Desktop\/workspace\/cli\/test\/jest\/acceptance\/snyk-container\/test-403-error-not-fixed-with-custom-error.spec.ts/i.