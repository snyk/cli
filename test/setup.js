const { getCliBinaryPath } = require('./jest/util/getCliBinaryPath');
const {
  isDontSkipTestsEnabled,
} = require('./jest/util/isDontSkipTestsEnabled');
const {
  fipsTestsEnabled,
  getFipsEnabledEnvironment,
} = require('./jest/util/fipsTestHelper');
const { runSnykCLI } = require('./jest/util/runSnykCLI');

module.exports = async function() {
  if (process.env.TEST_SNYK_COMMAND) {
    process.env.TEST_SNYK_COMMAND = getCliBinaryPath();
  }

  console.info(
    '\n------------------------------------------------------------------------------------------------------' +
      '\n Binary under test   [TEST_SNYK_COMMAND] .............. ' +
      process.env.TEST_SNYK_COMMAND +
      '\n Allow to skip tests [TEST_SNYK_DONT_SKIP_ANYTHING] ... ' +
      !isDontSkipTestsEnabled() +
      '\n Run FIPS tests      [TEST_SNYK_FIPS] ................. ' +
      fipsTestsEnabled() +
      '\n------------------------------------------------------------------------------------------------------',
  );

  if (
    process.env.SNYK_API_KEY ||
    process.env.SNYK_TOKEN ||
    process.env.TEST_SNYK_TOKEN === undefined
  ) {
    delete process.env.SNYK_TOKEN;
    delete process.env.SNYK_API_KEY;
    console.error(
      '\n------------------------------------------------------------' +
        '\n Currently Tests require the environment variable TEST_SNYK_TOKEN to be set.' +
        '\n This token is automatically stored on the config as some tests require this.' +
        '\n------------------------------------------------------------',
    );
  }

  if (fipsTestsEnabled()) {
    process.env = getFipsEnabledEnvironment();
  }

  if (process.env.TEST_SNYK_TOKEN !== undefined) {
    await runSnykCLI(`config set api=${process.env.TEST_SNYK_TOKEN}`);
  }
};
