# Snyk CLI Smoke Tests

Design goal is to have a single test suite, that can detect if CLI is not working properly - before and after it's released. Defects it should catch are e.g. [broken pkg builds for a specific platform](https://github.com/snyk/snyk/issues/670), [misaligned dependencies](https://github.com/snyk/snyk/issues/1261) or [issues with a specific installation targets](https://github.com/snyk/snyk/issues/1270).

CLI is being tested by a series of tests using [Shellspec](https://shellspec.info). See them in a `test/smoke/spec` folder.

Spec in this folder is used as a 1) **"Smoke test" step in CircleCI** to verify that built CLI can run 2) **["Smoke Tests"](https://github.com/snyk/snyk/actions?query=workflow%3A%22Smoke+Tests%22) GitHub Action** to verify that our distribution channels are working.

## How to add a new smoke test

Smoke tests should be fast. Ideally tests only things that could break when CLI is being built and packaged into binaries. Functionality should be tested our _other_ tests.

Before you start adding specs, those files are bash scripts, it's recommended to have a [ShellCheck](https://www.shellcheck.net) installed and running in your IDE. See [Shellspec reference](https://github.com/shellspec/shellspec/blob/master/docs/references.md#expectation) for available commands.

It's recommended to have a branch named `feat/smoke-test`, as [this branch will run the GitHub Action](https://github.com/snyk/snyk/blob/f35f39e96ef7aa69b22a846315dda015b12a4564/.github/workflows/smoke-tests.yml#L3-L5).

## TODO

### Missing scenarios

- [x] basics: version, help, config
- [x] auth [TOKEN]
- [ ] test [--json][npm project, java-goof]
- [ ] policy, ignore
- [ ] monitor
- [ ] wizard - possibly impossible? (maybe a basic test that it even loads)

### Missing environments

- [ ] Alpine binary
- [ ] Docker: current images can't output a clear stderr, because of an extraneous --json flag. Also released version is currently lagging behind the latest GitHub tag by a few hours
- [ ] yarn installation (see https://github.com/snyk/snyk/issues/1270)
- [ ] scoop package
