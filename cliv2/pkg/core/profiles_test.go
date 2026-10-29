package core

import (
	"context"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"testing"

	"github.com/rs/zerolog"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/error-catalog-golang-public/snyk_errors"

	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/configuration/profile"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

// writeProfile writes the profile of the given name, with the authentication token, under baseDir like the CLI does.
func writeProfile(t *testing.T, baseDir, name, token string) {
	t.Helper()
	file := filepath.Join(baseDir, "profiles", name+".json")
	require.NoError(t, os.MkdirAll(filepath.Dir(file), 0o700))
	require.NoError(t, os.WriteFile(file, []byte(fmt.Sprintf(`{%q:%q}`, configuration.AUTHENTICATION_TOKEN, token)), 0o600))
}

func Test_profileFlag_selectsTheProfileKey(t *testing.T) {
	t.Run("the environment variable selects the profile", func(t *testing.T) {
		t.Setenv("SNYK_CONFIG_PROFILE", "from-env")
		config := configuration.NewWithOpts(configuration.WithSupportedEnvVarPrefixes("snyk_"))
		initApplicationConfiguration(config)

		assert.Equal(t, "from-env", config.GetString(profile.ConfigKey))
	})

	t.Run("the flag wins over the environment variable", func(t *testing.T) {
		t.Setenv("SNYK_CONFIG_PROFILE", "from-env")
		config := configuration.NewWithOpts(configuration.WithSupportedEnvVarPrefixes("snyk_"))
		initApplicationConfiguration(config)
		flags := getGlobalFLags()
		require.NoError(t, flags.Parse([]string{"--" + profileFlag + "=from-flag"}))
		require.NoError(t, config.AddFlagSet(flags))

		assert.Equal(t, "from-flag", config.GetString(profile.ConfigKey))
	})

	t.Run("the flag does not clash with the profile flag of other commands", func(t *testing.T) {
		assert.Nil(t, getGlobalFLags().Lookup("profile"))
		assert.NotNil(t, getGlobalFLags().Lookup(profileFlag))
	})
}

func Test_enableProfiles_invocationsRunOnTheSelectedProfile(t *testing.T) {
	baseDir := t.TempDir()
	writeProfile(t, baseDir, "work", "work-token")

	base := configuration.NewWithOpts()
	base.Set(configuration.AUTHENTICATION_TOKEN, "default-token")
	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))
	logger := zerolog.New(os.Stderr).Level(zerolog.Disabled)
	r := &cliRun{engine: engine, config: base, logger: &logger}
	require.NoError(t, r.enableProfiles(baseDir))

	id := workflow.NewWorkflowIdentifier("test.profile.token")
	_, err := engine.Register(id, workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("test", pflag.ContinueOnError)),
		func(invocation workflow.InvocationContext, _ []workflow.Data) ([]workflow.Data, error) {
			token := invocation.GetConfiguration().GetString(configuration.AUTHENTICATION_TOKEN)
			return []workflow.Data{workflow.NewData(workflow.NewTypeIdentifier(id, "token"), "text/plain", token)}, nil
		})
	require.NoError(t, err)
	require.NoError(t, engine.Init())

	base.Set(profile.ConfigKey, "work")
	output, err := engine.Invoke(id)
	require.NoError(t, err)
	require.Len(t, output, 1)
	assert.Equal(t, "work-token", output[0].GetPayload())

	base.Set(profile.ConfigKey, "")
	output, err = engine.Invoke(id)
	require.NoError(t, err)
	require.Len(t, output, 1)
	assert.Equal(t, "default-token", output[0].GetPayload())
}

func Test_cliRun_profileConfig(t *testing.T) {
	baseDir := t.TempDir()
	writeProfile(t, baseDir, "work", "work-token")

	base := configuration.NewWithOpts()
	base.Set(configuration.AUTHENTICATION_TOKEN, "default-token")
	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))
	logger := zerolog.New(os.Stderr).Level(zerolog.Disabled)
	r := &cliRun{engine: engine, config: base, logger: &logger}
	require.NoError(t, r.enableProfiles(baseDir))

	t.Run("without a profile the configuration is the default one", func(t *testing.T) {
		config, err := r.profileConfig()
		require.NoError(t, err)
		assert.Same(t, base, config)
	})

	t.Run("the selected profile is returned, and the same instance on every call", func(t *testing.T) {
		base.Set(profile.ConfigKey, "work")
		first, err := r.profileConfig()
		require.NoError(t, err)
		second, err := r.profileConfig()
		require.NoError(t, err)

		assert.Equal(t, "work-token", first.GetString(configuration.AUTHENTICATION_TOKEN))
		assert.Same(t, first, second)
	})

	t.Run("a profile that does not exist fails with a validation error", func(t *testing.T) {
		base.Set(profile.ConfigKey, "missing")
		_, err := r.profileConfig()
		require.Error(t, err)
		var catalogErr snyk_errors.Error
		require.ErrorAs(t, err, &catalogErr, "the error is a catalog error")
		assert.Contains(t, catalogErr.Detail, "missing")
	})
}

func Test_refuseLegacyCommandForProfile(t *testing.T) {
	config := configuration.NewWithOpts()
	r := &cliRun{config: config}

	require.NoError(t, r.refuseLegacyCommandForProfile(), "without a profile the legacy CLI runs")

	config.Set(profile.ConfigKey, profile.DefaultName)
	require.NoError(t, r.refuseLegacyCommandForProfile(), "the default profile is not refused")

	config.Set(profile.ConfigKey, "work")
	assert.Error(t, r.refuseLegacyCommandForProfile(), "another profile is refused")
}

// This pins a known limitation: the environment is read for every profile, so SNYK_TOKEN applies to a profile that
// holds no token of its own. Blocking the credentials of the environment for profiles is the next step. When that
// lands, this test changes on purpose.
func Test_enableProfiles_environmentCredentialsStillApplyToAProfile(t *testing.T) {
	t.Setenv("SNYK_TOKEN", "env-token")
	baseDir := t.TempDir()
	require.NoError(t, os.MkdirAll(filepath.Join(baseDir, "profiles"), 0o700))
	require.NoError(t, os.WriteFile(filepath.Join(baseDir, "profiles", "work.json"), []byte("{}"), 0o600))

	base := configuration.NewWithOpts(configuration.WithAutomaticEnv(), configuration.WithSupportedEnvVarPrefixes("snyk_"))
	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))
	logger := zerolog.New(os.Stderr).Level(zerolog.Disabled)
	r := &cliRun{engine: engine, config: base, logger: &logger}
	require.NoError(t, r.enableProfiles(baseDir))

	base.Set(profile.ConfigKey, "work")
	config, err := r.profileConfig()
	require.NoError(t, err)
	assert.Equal(t, "env-token", config.GetString(configuration.AUTHENTICATION_TOKEN))
}

// writeProfileWithEndpoint writes a profile that talks to the endpoint with the token.
func writeProfileWithEndpoint(t *testing.T, baseDir, name, token, endpoint string) {
	t.Helper()
	file := filepath.Join(baseDir, "profiles", name+".json")
	require.NoError(t, os.MkdirAll(filepath.Dir(file), 0o700))
	content := fmt.Sprintf(`{%q:%q,%q:%q}`, configuration.AUTHENTICATION_TOKEN, token, configuration.API_URL, endpoint)
	require.NoError(t, os.WriteFile(file, []byte(content), 0o600))
}

// newProfileRun returns a run on a default configuration with the profiles of baseDir enabled.
func newProfileRun(t *testing.T, baseDir string) (*cliRun, configuration.Configuration) {
	t.Helper()
	base := configuration.NewWithOpts()
	base.Set(configuration.AUTHENTICATION_TOKEN, "default-token")
	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))
	logger := zerolog.New(os.Stderr).Level(zerolog.Disabled)
	r := &cliRun{engine: engine, config: base, logger: &logger}
	require.NoError(t, r.enableProfiles(baseDir))
	return r, base
}

func Test_sendAnalytics_sendsTheCredentialsOfTheProfile(t *testing.T) {
	var authorization string
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		authorization = req.Header.Get("Authorization")
		w.WriteHeader(http.StatusOK)
	}))
	defer server.Close()

	baseDir := t.TempDir()
	writeProfileWithEndpoint(t, baseDir, "work", "work-token", server.URL)
	r, base := newProfileRun(t, baseDir)
	base.Set(profile.ConfigKey, "work")
	config, err := r.profileConfig()
	require.NoError(t, err)

	r.sendAnalytics(context.Background(), config, analytics.New())

	assert.Equal(t, "token work-token", authorization, "the report goes to the profile's host with the profile's token")
}

func Test_logHeaderAuthorizationInfo_showsTheTokenOfTheProfile(t *testing.T) {
	baseDir := t.TempDir()
	writeProfileWithEndpoint(t, baseDir, "work", "work-token", "http://127.0.0.1:9")
	r, base := newProfileRun(t, baseDir)
	base.Set(profile.ConfigKey, "work")
	config, err := r.profileConfig()
	require.NoError(t, err)

	authorization, _, _ := r.logHeaderAuthorizationInfo(config)

	assert.Contains(t, authorization, redactAuthorizationTokens("work-token"))
	assert.NotContains(t, authorization, redactAuthorizationTokens("default-token"))
}

func Test_applyCommandSettings_setsTheSettingOnTheProfileToo(t *testing.T) {
	baseDir := t.TempDir()
	writeProfile(t, baseDir, "work", "work-token")
	r, base := newProfileRun(t, baseDir)
	base.Set(profile.ConfigKey, "work")
	config, err := r.profileConfig()
	require.NoError(t, err)
	require.NotSame(t, base, config)

	r.applyCommandSettings(config, func(c configuration.Configuration) { c.Set("internal_test_setting", true) })

	assert.True(t, base.GetBool("internal_test_setting"))
	assert.True(t, config.GetBool("internal_test_setting"), "the profile the command runs on gets the setting")
}
