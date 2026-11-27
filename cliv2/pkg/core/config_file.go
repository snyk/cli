package core

import (
	"fmt"

	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/snyk/error-catalog-golang-public/snyk"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"

	"github.com/snyk/cli/cliv2/internal/constants"
	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
)

// configFileOption selects the file named by SNYK_CONFIG_FILE, else snyk.json in the configstore directory.
func configFileOption(configFile string) configuration.Opts {
	if configFile == "" {
		return configuration.WithFiles("snyk")
	}
	return configuration.WithPinnedFile(configFile)
}

// checkConfigFile returns SNYK-CLI-0041 when config cannot use the file named by SNYK_CONFIG_FILE, so it has no storage.
func checkConfigFile(config configuration.Configuration, configFile string) error {
	if configFile == "" || config.GetStorage() != nil {
		return nil
	}
	return cli.NewConfigFileInvalidError(fmt.Sprintf("%s=%q cannot be used. Set it to the absolute path of a readable, writable JSON file.", constants.SNYK_CONFIG_FILE_ENV, configFile))
}

// explainIgnoredConfigFile returns SNYK-CLI-0040, caused by err, when err says the command is not authenticated, config
// has no credentials, and a configuration file in the working directory was ignored. Otherwise it returns err.
func explainIgnoredConfigFile(config configuration.Configuration, err error) error {
	if !cli_errors.HasErrorCode(err, snyk.NewUnauthorisedError("").ErrorCode, cli.NewAuthConfigError("").ErrorCode) || hasCredentials(config) {
		return err
	}
	warning := configuration.WorkingDirConfigFileWarning(config)
	if warning == "" {
		return err
	}
	return cli.NewConfigFileInWorkingDirectoryIgnoredError(
		fmt.Sprintf("%s Set %s to its absolute path, run `snyk auth`, or set SNYK_TOKEN.", warning, constants.SNYK_CONFIG_FILE_ENV),
		snyk_errors.WithCause(err),
	)
}

func hasCredentials(config configuration.Configuration) bool {
	for _, key := range []string{configuration.AUTHENTICATION_TOKEN, configuration.AUTHENTICATION_BEARER_TOKEN, auth.CONFIG_KEY_OAUTH_TOKEN} {
		if len(config.GetAllKeysThatContainValues(key)) > 0 {
			return true
		}
	}
	return false
}
