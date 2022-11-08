export function restoreEnvProxy(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  // WARN: We are restoring system en proxy because snyk cli override them but the proxy uses untrusted certs
  if (process.env.SNYK_SYSTEM_HTTP_PROXY != undefined) {
    env.HTTP_PROXY = process.env.SNYK_SYSTEM_HTTP_PROXY;
  }
  if (process.env.SNYK_SYSTEM_HTTPS_PROXY != undefined) {
    env.HTTPS_PROXY = process.env.SNYK_SYSTEM_HTTPS_PROXY;
  }
  if (process.env.SNYK_SYSTEM_NO_PROXY != undefined) {
    env.NO_PROXY = process.env.SNYK_SYSTEM_NO_PROXY;
  }
  return env;
}
