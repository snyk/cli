const { getCliBinaryPath } = require('./jest/util/getCliBinaryPath');
const {
  isDontSkipTestsEnabled,
} = require('./jest/util/isDontSkipTestsEnabled');
const {
  fipsTestsEnabled,
  getFipsEnabledEnvironment,
} = require('./jest/util/fipsTestHelper');
const { runSnykCLI } = require('./jest/util/runSnykCLI');

const TOKEN_ENV_VARS = ['TEST_SNYK_TOKEN', 'TEST_SNYK_TOKEN_2'];

function selectRandomToken() {
  const availableTokens = TOKEN_ENV_VARS.filter(
    (envVar) =>
      process.env[envVar] !== undefined && process.env[envVar].trim() !== '',
  );

  if (availableTokens.length === 0) {
    return { envVar: undefined, token: undefined };
  }

  // Shuffle array to randomize selection order
  const shuffled = availableTokens.sort(() => Math.random() - 0.5);

  // Return the first valid token from shuffled list
  for (const envVar of shuffled) {
    const token = process.env[envVar];
    if (token && token.trim() !== '') {
      return { envVar, token };
    }
  }

  return { envVar: undefined, token: undefined };
}

module.exports = async function () {
  if (process.env.TEST_SNYK_COMMAND) {
    process.env.TEST_SNYK_COMMAND = getCliBinaryPath();
  }

  const { envVar: selectedTokenEnvVar, token: selectedToken } =
    selectRandomToken();

  let tokenDisplay = 'UNSET';
  if (selectedToken !== undefined) {
    tokenDisplay = '***';
  }

  if (!process.env.TEST_SNYK_API) {
    process.env.TEST_SNYK_API = 'https://api.snyk.io';
  }

  if (!process.env.TEST_SNYK_ORG_SLUGNAME) {
    process.env.TEST_SNYK_ORG_SLUGNAME = 'team-cli-testing';
  }

  const { stdout: version } = await runSnykCLI('version');
  const SNYK_VERSION = version.trim();

  console.info(
    '\n------------------------------------------------------------------------------------------------------' +
      '\n Binary under test   [TEST_SNYK_COMMAND] .............. ' +
      process.env.TEST_SNYK_COMMAND +
      '\n Version under test  .................................. ' +
      SNYK_VERSION +
      '\n Allow to skip tests [TEST_SNYK_DONT_SKIP_ANYTHING] ... ' +
      !isDontSkipTestsEnabled() +
      '\n Run FIPS tests      [TEST_SNYK_FIPS] ................. ' +
      fipsTestsEnabled() +
      '\n Organization        [TEST_SNYK_ORG_SLUGNAME] ......... ' +
      process.env.TEST_SNYK_ORG_SLUGNAME +
      '\n Token               [' +
      (selectedTokenEnvVar || 'NONE') +
      '] ................ ' +
      tokenDisplay +
      '\n API                 [TEST_SNYK_API] .................. ' +
      process.env.TEST_SNYK_API +
      '\n------------------------------------------------------------------------------------------------------',
  );

  if (
    process.env.SNYK_API_KEY ||
    process.env.SNYK_TOKEN ||
    selectedToken === undefined
  ) {
    delete process.env.SNYK_TOKEN;
    delete process.env.SNYK_API_KEY;
    console.error(
      '\n------------------------------------------------------------' +
        '\n Currently Tests require one of the environment variables ' +
        TOKEN_ENV_VARS.join(', ') +
        ' to be set.' +
        '\n This token is automatically stored on the config as some tests require this.' +
        '\n------------------------------------------------------------',
    );
  }

  if (fipsTestsEnabled()) {
    process.env = getFipsEnabledEnvironment();
  }

  if (selectedToken !== undefined) {
    await runSnykCLI(`config set api=${selectedToken}`);
  }

  console.error(
    '\n------------------------------------------------------------' +
      '\n Environment successfully setup! Starting to run tests now!' +
      '\n------------------------------------------------------------',
  );
};
