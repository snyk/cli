package core

import (
	"github.com/snyk/go-application-framework/pkg/configuration/profile"
	"github.com/snyk/go-application-framework/pkg/workflow"

	"github.com/snyk/cli/cliv2/internal/identityenv"
)

// profileFlag selects the configuration profile of a command. It is not called "profile": commands such as `snyk mcp`
// have a flag of that name with another meaning.
const profileFlag = "config-profile"

// profileEnvAlias is the environment variable that selects the profile when the flag is not given.
const profileEnvAlias = "snyk_config_profile"

// profileDirEnvAlias is the environment variable that selects the directory of the profile files.
const profileDirEnvAlias = "snyk_config_profile_dir"

// selectProfile makes the configuration of the profile the configuration of the run. It runs once, in execute, after the
// engine is initialized and before anything can time out or report. The engine selects the same profile for its
// invocations, because it reads the name from its own configuration. When the profile cannot be used, profileErr holds
// the error-catalog error, and execute fails the run with it before any command runs.
//
// Under a named profile, ambient identity environment variables (SNYK_TOKEN, SNYK_CFG_API, OAuth storage, …) are
// ignored at Derive time; proxy, certificate, and SNYK_API still apply. Their names, identityenv.Vars, are set on the
// registry before its first profile is loaded, and the run fails with that error if they cannot be set.
func (r *cliRun) selectProfile() {
	name := r.profileName
	if name == "" || name == profile.DefaultName {
		return
	}
	// The engine owns the registry and may rebuild it, so it is asked for here and not kept.
	registry, err := workflow.GetProfileRegistry(r.engine)
	if err != nil {
		r.profileErr = err
		return
	}
	if err := registry.SetIgnoredEnvVars(identityenv.Vars()...); err != nil {
		r.profileErr = err
		return
	}
	p, err := registry.Profile(name)
	if err != nil {
		r.profileErr = err
		return
	}
	r.config = p.Configuration()
}
