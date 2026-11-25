package core

import (
	"github.com/snyk/error-catalog-golang-public/cli"

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

// selectProfile makes the configuration of the profile the configuration of the run and of the engine. It runs once,
// in execute, after the engine is initialized and before anything can time out or report. The engine rebinds network
// access to the profile; analytics stay unset until first GetAnalytics, which then reads the profile (CLI-2138). When
// the profile cannot be used the run keeps the default configuration, and profileErr holds the error-catalog error.
//
// Known limitation: environment variables such as SNYK_TOKEN, SNYK_API and the organization still apply to every
// profile, not only to the default one. Test_selectProfile_environmentCredentialsStillApplyToAProfile pins the current
// behavior.
func (r *cliRun) selectProfile() {
	name := r.profileName
	if name == "" || name == profile.DefaultName {
		return
	}
	cfg, err := workflow.SelectProfile(r.engine, name)
	if err != nil {
		r.profileErr = err
		return
	}
	r.config = cfg
}

// refuseLegacyCommandForProfile refuses the commands of the legacy CLI for a profile other than the default one. The
// legacy CLI is a separate process that only reads the default configuration file, so it would use the credentials of
// the default profile. It reads the name the run was started with, because the configuration of a selected profile does
// not name it.
func (r *cliRun) refuseLegacyCommandForProfile() error {
	name := r.profileName
	if name == "" || name == profile.DefaultName {
		return nil
	}
	return cli.NewValidationFailureError("This command currently doesn't support configuration profiles.")
}
