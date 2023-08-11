export const isDontSkipTestsEnabled = (): boolean => {
  const dontSkip = !(
    process.env.TEST_SNYK_DONT_SKIP_ANYTHING === undefined ||
    process.env.TEST_SNYK_DONT_SKIP_ANYTHING == '0'
  );
  return dontSkip;
};
