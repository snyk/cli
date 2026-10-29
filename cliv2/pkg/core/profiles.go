package core

import (
	"fmt"

	"github.com/snyk/error-catalog-golang-public/cli"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/configuration/profile"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

// profileFlag selects the configuration profile of a command. It is not called "profile": commands such as `snyk mcp`
// have a flag of that name with another meaning.
const profileFlag = "config-profile"

// profileEnvAlias is the environment variable that selects the profile when the flag is not given.
const profileEnvAlias = "snyk_config_profile"

// enableProfiles makes the engine run the root invocations of this run on the profile that the configuration selects.
// The profiles are files next to the default configuration, in the default storage directory.
//
// Known limitation: environment variables such as SNYK_TOKEN, SNYK_API and the organization still apply to every
// profile, not only to the default one. Blocking them for profiles is the next step; see
// Test_enableProfiles_environmentCredentialsStillApplyToAProfile, which pins the current behavior.
func (r *cliRun) enableProfiles(baseDir string) error {
	registry, err := profile.NewFileRegistry(baseDir, r.config)
	if err != nil {
		return err
	}
	r.profiles = registry
	return workflow.SetProfileRegistry(r.engine, registry)
}

// applyCommandSettings sets what only holds for this command, such as the presenter of a test command, on the run and
// on its profile. A profile is derived from the run's configuration, which does not carry values set on it afterwards.
func (r *cliRun) applyCommandSettings(profileConfig configuration.Configuration, settings ...func(configuration.Configuration)) {
	for _, setting := range settings {
		setting(r.config)
		if profileConfig != r.config {
			setting(profileConfig)
		}
	}
}

// profileConfig returns the configuration of the profile the command runs on, which is the one the engine selects for
// its invocations. The registry returns the same instance on every call, so the instance the run reports with is the
// one the engine clones. An error means the profile cannot be used. The callers then skip what would use the default
// profile's credentials: reporting, and the legacy CLI.
func (r *cliRun) profileConfig() (configuration.Configuration, error) {
	name := r.config.GetString(profile.ConfigKey)
	if name == "" || name == profile.DefaultName {
		return r.config, nil
	}
	if r.profiles == nil {
		return nil, cli.NewValidationFailureError(fmt.Sprintf("The configuration profile %q cannot be used, the profiles are not available.", name))
	}
	p, err := r.profiles.Profile(name)
	if err != nil {
		return nil, cli.NewValidationFailureError(fmt.Sprintf("The configuration profile %q cannot be used: %v", name, err))
	}
	return p.Configuration(), nil
}

// refuseLegacyCommandForProfile refuses the commands of the legacy CLI for a profile other than the default one. The
// legacy CLI is a separate process that only reads the default configuration file, so it would use the credentials of
// the default profile.
func (r *cliRun) refuseLegacyCommandForProfile() error {
	name := r.config.GetString(profile.ConfigKey)
	if name == "" || name == profile.DefaultName {
		return nil
	}
	return cli.NewValidationFailureError(fmt.Sprintf("This command cannot be used with the configuration profile %q, it runs in a separate process that only reads the default configuration.", name))
}
