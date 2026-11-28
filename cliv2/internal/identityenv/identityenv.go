// Package identityenv owns the environment variable names that must not affect credentials
// under a named config profile. The list lives in the CLI host, not in GAF.
package identityenv

// Vars returns the identity environment variable names ignored under a named profile. The CLI sets them on the profile
// registry in selectProfile, and removes them from the environment of the legacy CLI.
//
// SNYK_CFG_API is a token alias (not the API URL). SNYK_API and OAuth allowlist variables are
// intentionally absent so ambient API URL / allowlist values still apply under a named profile.
func Vars() []string {
	return []string{
		"SNYK_TOKEN",
		"SNYK_CFG_API",
		"SNYK_OAUTH_TOKEN",
		"SNYK_DOCKER_TOKEN",
		"INTERNAL_OAUTH_TOKEN_STORAGE",
		"INTERNAL_MACHINE_IDENTITY_STORAGE",
		"INTERNAL_NEW_SNYK_TOKEN",
	}
}
