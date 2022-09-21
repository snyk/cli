# Snyk Infrastructure as Code Smoke Tests

Design goal is to have a single test suite, aligned with the scope of the Snyk CLI's smoke tests, that can detect if IaC commands do not work properly - before and after it's released. The tests help us incorporate resources and requests made via network calls, to provide better coverage for the end to end flow of these commands. Some examples:

- Network calls made for fetching org properties, such as feature flags data, custom severities, etc.
- Downloading resources from CDNs, e.g., binary executables, ruleset bundles, etc.

The tests were written with Jest, and use a Snyk CLI executable either configured in the PATH environment variable, or overrode, using the `TEST_SNYK_COMMAND` environment variable, see more in the 'Notes on the

# Implementation details and usage

These smoke tests are written with Jest, using the Snyk CLI executable identified on the runtime environment (See 'Notes on the local run' section below to read on how to override it)

Spec in this folder is used as a

1. **"name: Infrastructure as Code Smoke Tests" Github Action** - these run every hour and upon releases.
2. **["Infrastructure as Code Smoke Tests (Pull Requests)"] GitHub Action** - these run for pull requests to the `master` branch which include changes to files owned by group IaC.

```sh
npm run test:smoke:iac
```

### Notes on the local run

These tests can be executed with the following npm script:

```
npm run test:smoke:iac
```

Alternatively, they can be executed directly via `jest`, by running:

```
npx jest test/smoke/iac/
```

You may specify any executable that will be used by the smoke tests, by configuring the `TEST_SNYK_COMMAND` environment variable. E.g. a local exuctable `TEST_SNYK_COMMAND="./snyk-macos"` or an `TEST_SNYK_COMMAND="npx snyk@1.500.0"` or `TEST_SNYK_COMMAND="node ./dist/cli"` for local execution.

You may also configure an authentication token with the `SNYK_TOKEN` environment variable, to run the tests with any org and user needed.
