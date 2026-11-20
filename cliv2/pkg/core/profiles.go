package core

import (
	"fmt"
	"os"
	"strings"

	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/configuration/profile"
	"github.com/snyk/go-application-framework/pkg/workflow"
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
// invocations, because it reads the name from its own configuration. When the profile cannot be used the run keeps the
// default configuration, and profileErr holds the error-catalog error.
//
// Under a named profile, ambient identity environment variables (SNYK_TOKEN, SNYK_CFG_API, OAuth storage, …) are
// ignored; proxy, certificate, and SNYK_API still apply. See app.IgnoreIdentityEnvVarsForProfile.
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
	p, err := registry.Profile(name)
	if err != nil {
		r.profileErr = err
		return
	}
	r.config = p.Configuration()
}

// warnIgnoredIdentityEnvVars prints one stderr warning naming each identity environment variable that is set in the
// process but ignored under the selected named profile. Values are never printed.
func (r *cliRun) warnIgnoredIdentityEnvVars() {
	if r.profileErr != nil || !profile.IsProfile(r.config) {
		return
	}
	var ignored []string
	for _, name := range app.IdentityEnvVars() {
		if _, ok := os.LookupEnv(name); ok {
			ignored = append(ignored, name)
		}
	}
	if len(ignored) == 0 {
		return
	}
	_, _ = fmt.Fprintf(os.Stderr,
		"Warning: ignoring identity environment variable(s) %s under config profile %q; credentials come from the profile.\n",
		strings.Join(ignored, ", "),
		r.profileName,
	)
}
