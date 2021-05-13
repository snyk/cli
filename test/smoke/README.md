# Snyk CLI Smoke Tests

Design goal is to have a single test suite, that can detect if CLI is not working properly - before and after it's released. Defects it should catch are e.g. [broken pkg builds for a specific platform](https://github.com/snyk/snyk/issues/670), [misaligned dependencies](https://github.com/snyk/snyk/issues/1261) or [issues with a specific installation targets](https://github.com/snyk/snyk/issues/1270).

CLI is being tested by a series of tests using [Shellspec](https://shellspec.info). See them in a `test/smoke/spec` folder.

Spec in this folder is used as a

1. **"Smoke test" step in CircleCI** to verify that built CLI can run
2. **["Smoke Tests"](https://github.com/snyk/snyk/actions?query=workflow%3A%22Smoke+Tests%22) GitHub Action** to verify that our distribution channels are working.

## How to add a new smoke test

Smoke tests should be fast. Ideally tests only things that could break when CLI is being built and packaged into binaries. Functionality should be tested our _other_ tests.

Before you start adding specs, those files are bash scripts, it's recommended to have a [ShellCheck](https://www.shellcheck.net) installed and running in your IDE. See [Shellspec reference](https://github.com/shellspec/shellspec/blob/master/docs/references.md#expectation) for available commands.

It's recommended to have a branch named `smoke/_SOMETHING_`, as [this branch will run the GitHub Action](https://github.com/snyk/snyk/blob/f35f39e96ef7aa69b22a846315dda015b12a4564/.github/workflows/smoke-tests.yml#L3-L5).

To run these tests locally you may use `npm run test:smoke`:

1. Install:

   - [Shellspec](https://shellspec.info) reccomended installation is through brew:

     - ### Install the latest stable version of shell spec
     - brew tap shellspec/shellspec
     - brew install shellspec

   - [jq](https://stedolan.github.io/jq/)
   - timeout (if not available on your platform)

2. Install dependencies for the local fixture `test/fixtures/basic-npm` with `npm install --prefix test/fixtures/basic-npm`

3. Run shellspec locally:

Note that you will need shellspec version `0.28.1` or higher.

From the root of the `snyk` repo, run:

```sh
npm run test:smoke
```

### Notes on the local run

`REGRESSION_TEST=1` enables the extended mode we use for regression testing. For the hourly tests in GitHub Actions we use a limited scope of tested commands.

You may specify an envvar `SNYK_COMMAND` to any executable that will be used by Smoke tests. E.g. a local exuctable `SNYK_COMMAND="./snyk-macos"` or an `SNYK_COMMAND="npx snyk@1.500.0"` or `SNYK_COMMAND="node ./dist/cli"` for local execution.

This will meddle with your `snyk config` file as Smoke Tests are checking functionality of `snyk config` command.

This will open a browser in one instance unless it's disabled with `SMOKE_TESTS_SKIP_TEST_THAT_OPENS_BROWSER=1` envvar. Opening of a browser is disabled by default when running Smoke tests with npm command `npm run test:smoke`.

## TODO

### Wishlist

- [ ] be able to run against PR

### Missing scenarios

- [x] basics: version, help, config
- [x] auth [TOKEN]
- [x] test [--json][npm project]
- [ ] test [--json][java-goof]
- [ ] policy, ignore
- [x] monitor [--json][npm project]
- [ ] monitor [--json][java-goof]
- [ ] wizard - possibly impossible? (maybe a basic test that it even loads)

### Missing environments

- [x] Alpine binary
- [ ] Docker: current images can't output a clear stderr, because of an extraneous --json flag. Also released version is currently lagging behind the latest GitHub tag by a few hours
- [x] yarn installation
- [ ] scoop package
- [x] homebrew

## Current workarounds and limitations

### Alpine

- Needs to run in a Docker container because GitHub Actions don't support Alpine as a host OS. Using shellspec container, as it's based on alpine and ready to run the tests.
- Need to skip a test that normally tries to open browser for login, but that fails horribly on Alpine.

To run the Alpine test in Docker locally (you probably don't want to…):

```
 docker build -f ./test/smoke/alpine/Dockerfile -t snyk-cli-alpine ./test/ && docker run --rm -eSMOKE_TESTS_SNYK_TOKEN=$SNYK_API_TOKEN snyk-cli-alpine
```

_Note: Alpine image is not copying/mounting everything, so you might need to add anything new to the `test/smoke/alpine/Dockerfile`_
