// Credentials the CLI reads for itself. Child processes such as build tools
// run code from the scanned project, so they must not inherit these.
const CREDENTIAL_ENV_VARS = [
  'SNYK_TOKEN',
  'SNYK_OAUTH_TOKEN',
  'SNYK_DOCKER_TOKEN',
  'SNYK_CFG_API',
  // User overrides for the credentials passed to snyk-iac-test
  'SNYK_IAC_TEST_API_REST_TOKEN',
  'SNYK_IAC_TEST_API_REST_OAUTH_TOKEN',
  'SNYK_IAC_TEST_API_V1_TOKEN',
  'SNYK_IAC_TEST_API_V1_OAUTH_TOKEN',
];

function isCredentialEnvVar(key: string): boolean {
  return CREDENTIAL_ENV_VARS.includes(key.toUpperCase());
}

const captured: Record<string, string> = {};

// Moves credentials out of process.env so every child process (including
// those spawned by ecosystem plugins, which copy process.env) starts without
// them. Call once, after modules that read them at load time are imported.
export function captureAndScrubCredentialEnv(
  env: NodeJS.ProcessEnv = process.env,
): void {
  for (const key of Object.keys(env)) {
    if (!isCredentialEnvVar(key)) {
      continue;
    }
    const value = env[key];
    if (value) {
      captured[key.toUpperCase()] = value;
    }
    delete env[key];
  }
}

// Reads a credential, whether or not it was already scrubbed from process.env.
export function getCredentialEnv(name: string): string | undefined {
  return captured[name] ?? process.env[name];
}

// Returns a copy of env with the captured credentials put back. Only use this
// for our own Go binary, never for third-party tools.
export function withCredentialEnv(env: NodeJS.ProcessEnv): NodeJS.ProcessEnv {
  return { ...env, ...captured };
}

// For tests only.
export function resetCapturedCredentialEnv(): void {
  for (const key of Object.keys(captured)) {
    delete captured[key];
  }
}
