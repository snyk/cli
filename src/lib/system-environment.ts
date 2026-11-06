import { restoreSystemEnv } from '@snyk/cli-interface';

/**
 * Env for Snyk's own child processes (the nested Go CLI). Restores the user's
 * proxy and OpenSSL settings and keeps SNYK_* variables. Returns a new object.
 */
export function restoreSystemEnvironment(
  env: NodeJS.ProcessEnv,
): NodeJS.ProcessEnv {
  // The parent Go process injects a fake SNYK_TOKEN as "random" into the
  // TypeScript CLI environment to bypass legacy auth checks. When re-invoking
  // the Go binary, this token tricks the child cli call into disabling OAuth and
  // attempting API-token auth, which fails. Removing it lets the child cli to
  // authenticate via config/keyring like a normal CLI invocation.
  const childEnv = { ...env };
  if (childEnv.SNYK_TOKEN === 'random') {
    delete childEnv.SNYK_TOKEN;
  }

  // The Go CLI overrides the proxy variables, but its proxy uses untrusted
  // certs, so child processes get the system values back.
  return restoreSystemEnv(childEnv, process.env);
}
