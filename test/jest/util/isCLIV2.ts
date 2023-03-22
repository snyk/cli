export const isCLIV2 = (): boolean => {
  return !!(
    process.env.TEST_SNYK_COMMAND &&
    (process.env.TEST_SNYK_COMMAND.includes('cliv2') ||
    process.env.TEST_SNYK_ALL_VERSIONS)
  );
};
