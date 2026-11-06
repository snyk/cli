/**
 * Undoes the environment changes the parent Go process makes before it starts
 * the TypeScript CLI, so child processes see what the user's shell had.
 * Mutates and returns `env`.
 */
export function restoreSystemEnvironment(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  // The parent Go process injects a fake SNYK_TOKEN as "random" into the
  // TypeScript CLI environment to bypass legacy auth checks. When re-invoking
  // the Go binary, this token tricks the child cli call into disabling OAuth and
  // attempting API-token auth, which fails. Removing it lets the child cli to
  // authenticate via config/keyring like a normal CLI invocation.
  if (env.SNYK_TOKEN === 'random') {
    delete env.SNYK_TOKEN;
  }

  // The Go CLI overrides the proxy variables, but its proxy uses untrusted
  // certs, so child processes get the system values back.
  if (process.env.SNYK_SYSTEM_HTTP_PROXY != undefined) {
    env.HTTP_PROXY = process.env.SNYK_SYSTEM_HTTP_PROXY;
  }
  if (process.env.SNYK_SYSTEM_HTTPS_PROXY != undefined) {
    env.HTTPS_PROXY = process.env.SNYK_SYSTEM_HTTPS_PROXY;
  }
  if (process.env.SNYK_SYSTEM_NO_PROXY != undefined) {
    env.NO_PROXY = process.env.SNYK_SYSTEM_NO_PROXY;
  }
  if (process.env.SNYK_SYSTEM_OPENSSL_CONF != undefined) {
    env.OPENSSL_CONF = process.env.SNYK_SYSTEM_OPENSSL_CONF;
  }
  return env;
}
