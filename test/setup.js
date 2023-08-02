const { getCliBinaryPath } = require('./jest/util/getCliBinaryPath');

module.exports = async function() {
  if (process.env.TEST_SNYK_COMMAND) {
    process.env.TEST_SNYK_COMMAND = getCliBinaryPath();
  }

  console.info(
    '\n------------------------------------------------------------' +
      '\n Binary under test:   ' +
      process.env.TEST_SNYK_COMMAND +
      '\n------------------------------------------------------------',
  );

  if (process.env.SNYK_TOKEN || process.env.TEST_SNYK_TOKEN === undefined) {
    delete process.env.SNYK_TOKEN;
    console.error(
      '\n------------------------------------------------------------' +
        '\n Currently Tests require a token to be stored in the config' +
        '\n and set via the environment variable TEST_SNYK_TOKEN!' +
        '\n------------------------------------------------------------',
    );
  }
};
