package core

import (
	"path/filepath"

	"github.com/snyk/error-catalog-golang-public/cli"

	"github.com/snyk/go-application-framework/pkg/configuration/profile"
	"github.com/snyk/go-application-framework/pkg/workflow"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
)

// profileFlag selects the configuration profile of a command. It is not called "profile": commands such as `snyk mcp`
// have a flag of that name with another meaning.
const profileFlag = basic_workflows.CONFIG_PROFILE

// profileEnvAlias is the environment variable that selects the profile when the flag is not given.
const profileEnvAlias = "snyk_config_profile"

// profileDirEnvAlias is the environment variable that selects the directory of the profile files.
const profileDirEnvAlias = "snyk_config_profile_dir"

// selectProfile makes the configuration of the profile the configuration of the run. It runs once, in execute, after the
// engine is initialized and before anything can time out or report. The engine selects the same profile for its
// invocations, because it reads the name from its own configuration. When the profile cannot be used the run keeps the
// default configuration, and profileErr holds the error-catalog error.
//
// The legacy CLI is a separate process that gets no configuration, so the absolute path of the profile file is set in
// its configuration, which the legacy CLI gets in its environment.
//
// Known limitation: environment variables such as SNYK_TOKEN, SNYK_API and the organization still apply to every
// profile, not only to the default one. Test_selectProfile_environmentCredentialsStillApplyToAProfile pins the current
// behavior.
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
	profileFile := filepath.Join(r.config.GetString(profile.DirKey), name+".json")
	r.config = p.Configuration()
	r.config.Set(cliv2.ConfigKeyProfileFile, profileFile)
}

// refuseLegacyCommandForProfile refuses the commands that run only in the legacy CLI for a profile other than the
// default one. It reads the name the run was started with, because the configuration of a selected profile does not
// name it.
func (r *cliRun) refuseLegacyCommandForProfile() error {
	name := r.profileName
	if name == "" || name == profile.DefaultName {
		return nil
	}
	return cli.NewValidationFailureError("This command currently doesn't support configuration profiles.")
}
