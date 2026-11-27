package core

import (
	"errors"
	"os"
	"path/filepath"
	"testing"

	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/snyk/error-catalog-golang-public/snyk"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
)

func Test_checkConfigFile(t *testing.T) {
	t.Setenv("HOME", t.TempDir())

	tests := []struct {
		name       string
		configFile string
		noHome     bool
		wantErr    bool
	}{
		{name: "not set", configFile: ""},
		{name: "not set without a home directory", configFile: "", noHome: true},
		{name: "usable file", configFile: filepath.Join(t.TempDir(), "snyk.json")},
		{name: "unusable file", configFile: "snyk.json", wantErr: true},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			if tc.noHome {
				t.Setenv("HOME", "")
			}
			config := configuration.NewWithOpts(configFileOption(tc.configFile))

			err := checkConfigFile(config, tc.configFile)

			if !tc.wantErr {
				require.NoError(t, err)
				return
			}
			catalogErr := requireCatalogError(t, err, cli.NewConfigFileInvalidError("").ErrorCode)
			assert.Contains(t, catalogErr.Detail, `SNYK_CONFIG_FILE="snyk.json"`)
		})
	}
}

func Test_explainIgnoredConfigFile(t *testing.T) {
	unauthorised := snyk.NewUnauthorisedError("")

	tests := []struct {
		name          string
		err           error
		token         string
		noIgnoredFile bool
		pinned        bool
		wantExplained bool
	}{
		{name: "unauthorised", err: unauthorised, wantExplained: true},
		{name: "missing token", err: cli.NewAuthConfigError(""), wantExplained: true},
		{name: "unauthorised among other errors", err: errors.Join(errors.New("exit status 2"), unauthorised), wantExplained: true},
		{name: "unauthorised with a token", err: unauthorised, token: "a-token"},
		{name: "unauthorised without an ignored file", err: unauthorised, noIgnoredFile: true},
		{name: "unauthorised with SNYK_CONFIG_FILE", err: unauthorised, pinned: true},
		{name: "another error", err: errors.New("something else failed")},
	}
	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			t.Setenv("HOME", t.TempDir())
			workingDir := t.TempDir()
			t.Chdir(workingDir)
			ignoredFile := filepath.Join(workingDir, "snyk.json")
			if !tc.noIgnoredFile {
				require.NoError(t, os.WriteFile(ignoredFile, []byte(`{"api":"ignored-token"}`), 0o600))
			}
			configFile := ""
			if tc.pinned {
				configFile = filepath.Join(t.TempDir(), "snyk.json")
			}
			config := configuration.NewWithOpts(configFileOption(configFile))
			if tc.token != "" {
				config.Set(configuration.AUTHENTICATION_TOKEN, tc.token)
			}

			err := explainIgnoredConfigFile(config, tc.err)

			if !tc.wantExplained {
				assert.Equal(t, tc.err, err)
				return
			}
			catalogErr := requireCatalogError(t, err, cli.NewConfigFileInWorkingDirectoryIgnoredError("").ErrorCode)
			assert.Contains(t, catalogErr.Detail, ignoredFile)
			assert.Contains(t, catalogErr.Detail, constants.SNYK_CONFIG_FILE_ENV)
			assert.Equal(t, tc.err, catalogErr.Cause)
		})
	}
}

func Test_explainIgnoredConfigFile_keepsTheExitCode(t *testing.T) {
	t.Setenv("HOME", t.TempDir())
	t.Chdir(t.TempDir())
	require.NoError(t, os.WriteFile("snyk.json", []byte(`{"api":"ignored-token"}`), 0o600))
	err := createErrorWithExitCode(constants.SNYK_EXIT_CODE_EX_NOPERM, snyk.NewUnauthorisedError(""))

	explained := explainIgnoredConfigFile(configuration.NewWithOpts(configFileOption("")), err)

	_ = requireCatalogError(t, explained, cli.NewConfigFileInWorkingDirectoryIgnoredError("").ErrorCode)
	assert.Equal(t, constants.SNYK_EXIT_CODE_EX_NOPERM, cliv2.DeriveExitCode(explained))
}
