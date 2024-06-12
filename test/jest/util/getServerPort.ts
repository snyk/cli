export const getServerPort = (process: NodeJS.Process): string => {
  return process.env.PORT || process.env.SNYK_PORT || "12345";
};
