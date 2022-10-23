# Snyk Infrastructure as Code Smoke Tests

Design goal is to have a single test suite, aligned with the scope of the Snyk CLI's smoke tests, that can detect if IaC commands do not work properly - before and after it's released. The tests help us incorporate resources and requests made via network calls, to provide better coverage for the end to end flow of these commands. Some examples:

- Network calls made for fetching org properties, such as feature flags data, custom severities, etc.
- Downloading resources from CDNs, e.g., binary executables, ruleset bundles, etc.

The tests were written with Jest, and use a Snyk CLI executable either configured in the PATH environment variable, or overrode, using the `TEST_SNYK_COMMAND` environment variable, see more in the 'Notes on the

# Implementation details and usage

These smoke tests are written with Jest, using the Snyk CLI executable identified on the runtime environment (See 'Notes on the local run' section below to read on how to override it).

The org we are using for testing is `snyk-cloud-tests` with the authentication token of the `Snyk IaC CLI smoke tests` service account which is available in [1Password](https://start.1password.com/open/i?a=PVJXHTLBRZAU5B6AZPH4R2XPKY&v=kbuze2xep3omyofrpfvvzmkwua&i=5h2xwp4d4rb4ng7arqadwxb3mu&h=team-snyk.1password.com).

Spec in this folder is used as a

1. **"name: Infrastructure as Code Smoke Tests" Github Action** - these run every hour and upon releases.
2. **["Infrastructure as Code Smoke Tests (Pull Requests)"] GitHub Action** - these run for pull requests to the `master` branch which include changes to files owned by group IaC.

### Notes on the local run

These tests can be executed directly via `jest`, by running:

```
npx jest test/smoke/iac/
```

By default the jest runner uses the `bin/snyk` script in the repository which points to `dist/cli/index.js`. If you want to use a different Snyk CLI executable, you can override it by setting the `TEST_SNYK_COMMAND` environment variable.

You may also configure an authentication token with the `IAC_SMOKE_TESTS_SNYK_TOKEN` environment variable, to run the tests with any org and user needed.
