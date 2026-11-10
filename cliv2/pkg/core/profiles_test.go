package core

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"os"
	"path/filepath"
	"sync"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"

	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/configuration/profile"
	"github.com/snyk/go-application-framework/pkg/networking"
	"github.com/snyk/go-application-framework/pkg/utils"
	"github.com/snyk/go-application-framework/pkg/workflow"

	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
)

// writeProfile writes the profile of the given name, with the authentication token, under profileDir like the CLI does.
func writeProfile(t *testing.T, profileDir, name, token string) {
	t.Helper()
	writeProfileValues(t, profileDir, name, map[string]any{configuration.AUTHENTICATION_TOKEN: token})
}

// writeProfileValues writes the profile of the given name with the given values under profileDir.
func writeProfileValues(t *testing.T, profileDir, name string, values map[string]any) {
	t.Helper()
	content, err := json.Marshal(values)
	require.NoError(t, err)
	file := filepath.Join(profileDir, name+".json")
	require.NoError(t, os.MkdirAll(filepath.Dir(file), 0o700))
	require.NoError(t, os.WriteFile(file, content, 0o600))
}

// corruptProfileContent is the content of a profile file that is not JSON, so the profile cannot be loaded.
const corruptProfileContent = "{not json"

// writeCorruptProfile writes the profile of the given name under profileDir with content that is not JSON. A profile
// without a file is empty, so a profile that fails to load needs a file that is broken.
func writeCorruptProfile(t *testing.T, profileDir, name string) {
	t.Helper()
	file := filepath.Join(profileDir, name+".json")
	require.NoError(t, os.MkdirAll(filepath.Dir(file), 0o700))
	require.NoError(t, os.WriteFile(file, []byte(corruptProfileContent), 0o600))
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

// The directory of the profiles is selected with SNYK_CONFIG_PROFILE_DIR. The configuration is set up as execute sets it up,
// except for the files, which would read the developer's own configuration.
func Test_profileDir_envVarSelectsTheDirectory(t *testing.T) {
	profileDir := t.TempDir()
	t.Setenv("SNYK_CONFIG_PROFILE_DIR", profileDir)
	config := configuration.NewWithOpts(
		configuration.WithSupportedEnvVars("NODE_EXTRA_CA_CERTS"),
		configuration.WithSupportedEnvVarPrefixes("snyk_", "internal_", "test_"),
		configuration.WithCachingEnabled(configuration.NoCacheExpiration),
	)
	initApplicationConfiguration(config)

	assert.Equal(t, profileDir, config.GetString(profile.DirKey))
}

func Test_profileSelection_invocationsRunOnTheSelectedProfile(t *testing.T) {
	profileDir := t.TempDir()
	writeProfile(t, profileDir, "work", "work-token")

	base := configuration.NewWithOpts()
	base.Set(configuration.AUTHENTICATION_TOKEN, "default-token")
	base.Set(profile.DirKey, profileDir)
	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))

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

func Test_selectProfile_theConfigurationOfTheRunIsTheProfile(t *testing.T) {
	profileDir := t.TempDir()
	writeProfile(t, profileDir, "work", "work-token")

	base := configuration.NewWithOpts()
	base.Set(configuration.AUTHENTICATION_TOKEN, "default-token")
	base.Set(profile.DirKey, profileDir)
	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))
	logger := zerolog.New(os.Stderr).Level(zerolog.Disabled)
	r := &cliRun{engine: engine, config: base, logger: &logger}
	require.NoError(t, engine.Init())

	t.Run("without a profile the configuration is the default one", func(t *testing.T) {
		r.profileName = ""
		r.selectProfile()
		require.NoError(t, r.profileErr)
		assert.Same(t, base, r.config)
	})

	t.Run("the selected profile is the configuration of the run", func(t *testing.T) {
		r := &cliRun{engine: engine, config: base, logger: &logger, profileName: "work"}
		r.selectProfile()
		require.NoError(t, r.profileErr)
		assert.NotSame(t, base, r.config)
		assert.Equal(t, "work-token", r.config.GetString(configuration.AUTHENTICATION_TOKEN))
	})

	t.Run("a profile whose file is corrupt fails with a validation error and keeps the default configuration", func(t *testing.T) {
		writeCorruptProfile(t, profileDir, "broken")
		r := &cliRun{engine: engine, config: base, logger: &logger, profileName: "broken"}
		r.selectProfile()
		catalogErr := requireCatalogError(t, r.profileErr, cli.NewConfigProfileUnreadableError("").ErrorCode)
		assert.Contains(t, catalogErr.Detail, "broken")
		assert.Same(t, base, r.config)
		content, err := os.ReadFile(filepath.Join(profileDir, "broken.json"))
		require.NoError(t, err)
		assert.Equal(t, corruptProfileContent, string(content), "the corrupt file is not overwritten")
	})
}

// A profile without a file is an empty profile. Selecting it creates nothing, and the first persisted write through its
// configuration creates the file, as the auth workflow does for its token.
func Test_selectProfile_aProfileWithoutAFileIsEmpty(t *testing.T) {
	setup := func(t *testing.T) (*cliRun, configuration.Configuration, string) {
		t.Helper()
		// the directory does not exist yet, so the test sees whether selecting the profile creates it
		profileDir := filepath.Join(t.TempDir(), "not-yet-created")
		r, base := newProfileRun(t, profileDir)
		initRun(t, r)
		r.profileName = "fresh"
		r.selectProfile()
		require.NoError(t, r.profileErr, "a missing file is not an error")
		return r, base, profileDir
	}

	t.Run("the run works on an empty profile and nothing is created", func(t *testing.T) {
		r, base, profileDir := setup(t)

		assert.NotSame(t, base, r.config, "the run works on the profile")
		assert.Empty(t, r.config.GetString(configuration.AUTHENTICATION_TOKEN), "the profile holds no values of its own")
		_, err := os.Stat(profileDir)
		assert.ErrorIs(t, err, os.ErrNotExist, "neither the profile directory nor the profile file is created")
	})

	t.Run("the first persisted write creates the profile file", func(t *testing.T) {
		r, _, profileDir := setup(t)

		r.config.PersistInStorage(auth.CONFIG_KEY_TOKEN)
		r.config.Set(auth.CONFIG_KEY_TOKEN, "fresh-token")

		content, err := os.ReadFile(filepath.Join(profileDir, "fresh.json"))
		require.NoError(t, err)
		want, err := json.Marshal(map[string]string{auth.CONFIG_KEY_TOKEN: "fresh-token"})
		require.NoError(t, err)
		assert.JSONEq(t, string(want), string(content))
	})
}

// requireCatalogError asserts that err is the error-catalog error with the given code, returned as it is and not wrapped,
// and returns it. The command reports the code and the reason of the catalog error, so a wrapped or re-coded error
// hides them from the user.
func requireCatalogError(t *testing.T, err error, code string) snyk_errors.Error {
	t.Helper()
	require.Error(t, err)
	require.IsType(t, snyk_errors.Error{}, err, "the error is the catalog error itself, not wrapped")
	var catalogErr snyk_errors.Error
	require.ErrorAs(t, err, &catalogErr, "the error is a catalog error")
	assert.Equal(t, code, catalogErr.ErrorCode)
	return catalogErr
}

func Test_selectProfile_failsWhenTheRegistryIsUnavailable(t *testing.T) {
	t.Run("a base directory that is not absolute", func(t *testing.T) {
		base := configuration.NewWithOpts()
		base.Set(profile.DirKey, "relative/dir")
		engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))
		logger := zerolog.New(os.Stderr).Level(zerolog.Disabled)
		r := &cliRun{engine: engine, config: base, logger: &logger, profileName: "work"}

		r.selectProfile()
		_ = requireCatalogError(t, r.profileErr, cli.NewConfigProfileDirectoryInvalidError("").ErrorCode)
		assert.Same(t, base, r.config)
	})

	t.Run("an engine without profiles", func(t *testing.T) {
		base := configuration.NewWithOpts()
		r := &cliRun{config: base, profileName: "work"}

		r.selectProfile()
		_ = requireCatalogError(t, r.profileErr, cli.NewConfigProfilesUnavailableError("").ErrorCode)
		assert.Same(t, base, r.config)
	})
}

func Test_refuseLegacyCommandForProfile(t *testing.T) {
	r := &cliRun{config: configuration.NewWithOpts()}

	require.NoError(t, r.refuseLegacyCommandForProfile(), "without a profile the legacy CLI runs")

	r.profileName = profile.DefaultName
	require.NoError(t, r.refuseLegacyCommandForProfile(), "the default profile is not refused")

	r.profileName = "work"
	assert.Error(t, r.refuseLegacyCommandForProfile(), "another profile is refused")
}

// The help of a legacy command reads no credentials, so it is not refused for a profile, while running the legacy command
// is. The legacy workflow is replaced by a stub that records the invocation.
func Test_legacyHelp_isNotRefusedForAProfile(t *testing.T) {
	newRunWithLegacyStub := func(t *testing.T, profileName string) (*cliRun, *int) {
		t.Helper()
		r := &cliRun{config: configuration.NewWithOpts(), profileName: profileName}
		engine := app.CreateAppEngineWithOptions(app.WithConfiguration(r.config))
		invocations := 0
		_, err := engine.Register(basic_workflows.WORKFLOWID_LEGACY_CLI,
			workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("test", pflag.ContinueOnError)),
			func(_ workflow.InvocationContext, _ []workflow.Data) ([]workflow.Data, error) {
				invocations++
				return nil, nil
			})
		require.NoError(t, err)
		require.NoError(t, engine.Init())
		r.engine = engine
		return r, &invocations
	}

	oldArgs := append([]string{}, os.Args...)
	defer func() { os.Args = oldArgs }()
	os.Args = []string{"snyk", "legacy-cmd", "--help"}

	t.Run("the help reaches the legacy workflow for another profile", func(t *testing.T) {
		r, invocations := newRunWithLegacyStub(t, "work")

		require.NoError(t, r.runLegacyHelp())
		assert.Equal(t, 1, *invocations)
	})

	t.Run("running the legacy command is refused for another profile and does not invoke the workflow", func(t *testing.T) {
		r, invocations := newRunWithLegacyStub(t, "work")

		_ = requireCatalogError(t, r.defaultCmd([]string{"legacy-cmd"}), cli.NewValidationFailureError("").ErrorCode)
		assert.Equal(t, 0, *invocations)
	})
}

// This pins a known limitation: the environment is read for every profile, so SNYK_TOKEN applies to a profile that
// holds no token of its own. Blocking the credentials of the environment for profiles is the next step. When that
// lands, this test changes on purpose.
func Test_selectProfile_environmentCredentialsStillApplyToAProfile(t *testing.T) {
	t.Setenv("SNYK_TOKEN", "env-token")
	profileDir := t.TempDir()
	require.NoError(t, os.WriteFile(filepath.Join(profileDir, "work.json"), []byte("{}"), 0o600))

	base := configuration.NewWithOpts(configuration.WithAutomaticEnv(), configuration.WithSupportedEnvVarPrefixes("snyk_"))
	base.Set(profile.DirKey, profileDir)
	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))
	require.NoError(t, engine.Init())
	logger := zerolog.New(os.Stderr).Level(zerolog.Disabled)
	r := &cliRun{engine: engine, config: base, logger: &logger, profileName: "work"}

	r.selectProfile()
	require.NoError(t, r.profileErr)
	assert.Equal(t, "env-token", r.config.GetString(configuration.AUTHENTICATION_TOKEN))
}

// writeProfileWithEndpoint writes a profile that talks to the endpoint with the token.
func writeProfileWithEndpoint(t *testing.T, profileDir, name, token, endpoint string) {
	t.Helper()
	writeProfileValues(t, profileDir, name, map[string]any{
		configuration.AUTHENTICATION_TOKEN: token,
		configuration.API_URL:              endpoint,
	})
}

// newProfileRun returns a run on a default configuration with the profiles of profileDir enabled.
func newProfileRun(t *testing.T, profileDir string) (*cliRun, configuration.Configuration) {
	t.Helper()
	base := configuration.NewWithOpts()
	base.Set(configuration.AUTHENTICATION_TOKEN, "default-token")
	base.Set(profile.DirKey, profileDir)
	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))
	logger := zerolog.New(os.Stderr).Level(zerolog.Disabled)
	r := &cliRun{engine: engine, config: base, logger: &logger}
	return r, base
}

// recordedRequest is what requestLog keeps of a request: the method and the Authorization header.
type recordedRequest struct {
	method        string
	authorization string
}

// requestLog records the requests a test server receives.
type requestLog struct {
	mu       sync.Mutex
	requests []recordedRequest
}

func newRequestLog(t *testing.T) (*httptest.Server, *requestLog) {
	t.Helper()
	log := &requestLog{}
	server := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, req *http.Request) {
		log.mu.Lock()
		log.requests = append(log.requests, recordedRequest{method: req.Method, authorization: req.Header.Get("Authorization")})
		log.mu.Unlock()
		w.WriteHeader(http.StatusOK)
	}))
	t.Cleanup(server.Close)
	return server, log
}

// reset forgets the requests received so far.
func (l *requestLog) reset() {
	l.mu.Lock()
	defer l.mu.Unlock()
	l.requests = nil
}

// all returns the Authorization header of every request.
func (l *requestLog) all() []string {
	l.mu.Lock()
	defer l.mu.Unlock()
	authorizations := make([]string, 0, len(l.requests))
	for _, req := range l.requests {
		authorizations = append(authorizations, req.authorization)
	}
	return authorizations
}

// posts returns the Authorization header of every POST request, which is how the reports are sent.
func (l *requestLog) posts() []string {
	l.mu.Lock()
	defer l.mu.Unlock()
	var authorizations []string
	for _, req := range l.requests {
		if req.method == http.MethodPost {
			authorizations = append(authorizations, req.authorization)
		}
	}
	return authorizations
}

func Test_sendAnalytics_sendsTheCredentialsOfTheProfile(t *testing.T) {
	server, log := newRequestLog(t)

	profileDir := t.TempDir()
	writeProfileWithEndpoint(t, profileDir, "work", "work-token", server.URL)
	r, _ := newProfileRun(t, profileDir)
	r.profileName = "work"
	r.selectProfile()
	require.NoError(t, r.profileErr)

	r.sendAnalytics(context.Background(), analytics.New())

	assert.Equal(t, []string{"token work-token"}, log.all(), "the report goes to the profile's host with the profile's token")
}

func Test_logHeaderAuthorizationInfo_showsTheTokenOfTheProfile(t *testing.T) {
	profileDir := t.TempDir()
	writeProfileWithEndpoint(t, profileDir, "work", "work-token", "http://127.0.0.1:9")
	r, _ := newProfileRun(t, profileDir)
	r.profileName = "work"
	r.selectProfile()
	require.NoError(t, r.profileErr)

	authorization, _, _ := r.logHeaderAuthorizationInfo()

	assert.Contains(t, authorization, redactAuthorizationTokens("work-token"))
	assert.NotContains(t, authorization, redactAuthorizationTokens("default-token"))
}

// initRun initializes the engine of a run, which the teardown needs for its cleanup and its reports.
func initRun(t *testing.T, r *cliRun) {
	t.Helper()
	require.NoError(t, r.engine.Init())
}

// (a) A setting that a command wrapper sets on the run's configuration after the selection reaches the engine invocations
// on the profile, and the default configuration does not get it.
func Test_settingSetAfterTheSelection_reachesTheEngineOnTheProfileOnly(t *testing.T) {
	const setting = "internal_test_setting"
	profileDir := t.TempDir()
	writeProfile(t, profileDir, "work", "work-token")
	r, base := newProfileRun(t, profileDir)

	id := workflow.NewWorkflowIdentifier("test.profile.setting")
	_, err := r.engine.Register(id, workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("test", pflag.ContinueOnError)),
		func(invocation workflow.InvocationContext, _ []workflow.Data) ([]workflow.Data, error) {
			value := invocation.GetConfiguration().GetBool(setting)
			return []workflow.Data{workflow.NewData(workflow.NewTypeIdentifier(id, "setting"), "text/plain", fmt.Sprint(value))}, nil
		})
	require.NoError(t, err)
	initRun(t, r)

	base.Set(profile.ConfigKey, "work")
	r.profileName = "work"
	r.selectProfile()
	require.NoError(t, r.profileErr)
	r.config.Set(setting, true)

	assert.NotSame(t, base, r.config, "the run works on the profile")
	assert.True(t, r.config.GetBool(setting), "the run's configuration has the setting")
	assert.False(t, base.GetBool(setting), "the default configuration does not get the setting")

	output, err := r.engine.Invoke(id)
	require.NoError(t, err)
	require.Len(t, output, 1)
	assert.Equal(t, "true", output[0].GetPayload(), "the engine invocation receives the setting")
}

// (b) After the selection the run's configuration no longer names the profile, so the legacy refusal reads the name of
// the run and not the configuration.
func Test_refuseLegacyCommandForProfile_holdsAfterTheSelection(t *testing.T) {
	profileDir := t.TempDir()
	writeProfile(t, profileDir, "work", "work-token")

	t.Run("another profile is refused", func(t *testing.T) {
		r, base := newProfileRun(t, profileDir)
		base.Set(profile.ConfigKey, "work")
		r.profileName = "work"
		r.selectProfile()
		require.NoError(t, r.profileErr)

		assert.Empty(t, r.config.GetString(profile.ConfigKey), "the selected configuration does not name the profile")
		assert.Error(t, r.refuseLegacyCommandForProfile())
	})

	t.Run("the default profile is allowed", func(t *testing.T) {
		r, _ := newProfileRun(t, profileDir)
		r.profileName = profile.DefaultName
		r.selectProfile()
		require.NoError(t, r.profileErr)

		assert.NoError(t, r.refuseLegacyCommandForProfile())
	})
}

// (c) A profile that cannot be selected fails the command with the validation error before any setting is applied. The
// run keeps the default configuration, and nothing is reported with the default credentials.
func Test_runMainWorkflow_aBrokenProfileFailsAndReportsNothing(t *testing.T) {
	server, log := newRequestLog(t)
	profileDir := t.TempDir()
	writeProfile(t, profileDir, "work", "work-token")
	writeCorruptProfile(t, profileDir, "broken")
	r, base := newProfileRun(t, profileDir)
	base.Set(configuration.API_URL, server.URL)
	base.Set(profile.ConfigKey, "broken")
	initRun(t, r)
	r.profileName = "broken"
	r.selectProfile()

	unreadable := cli.NewConfigProfileUnreadableError("").ErrorCode
	_ = requireCatalogError(t, r.profileErr, unreadable)
	assert.Same(t, base, r.config, "the run keeps the default configuration")

	cmd := &cobra.Command{Use: "test"}
	err := r.runMainWorkflow(cmd, nil, nil)

	_ = requireCatalogError(t, err, unreadable)
	assert.Error(t, r.refuseLegacyCommandForProfile(), "the legacy CLI stays refused")

	_ = r.tearDown(context.Background(), nil, nil, time.Now(), networking.UserAgentInfo{}, r.engine.GetAnalytics())
	assert.Empty(t, log.posts(), "no report is sent, neither with the default credentials nor with others")
}

// (d) A teardown right after the early selection, for example after a timeout, reports with the profile's credentials
// and never with the default profile's. The name is in the configuration of the engine from the start, as execute sets
// it, so the engine's own invocations of the teardown use the profile too.
func Test_tearDown_afterTheSelectionDoesNotReportWithTheDefaultCredentials(t *testing.T) {
	defaultServer, defaultLog := newRequestLog(t)
	workServer, workLog := newRequestLog(t)
	profileDir := t.TempDir()
	writeProfileWithEndpoint(t, profileDir, "work", "work-token", workServer.URL)
	r, base := newProfileRun(t, profileDir)
	base.Set(configuration.API_URL, defaultServer.URL)
	base.Set(profile.ConfigKey, "work")
	initRun(t, r)
	r.profileName = "work"
	r.selectProfile()
	require.NoError(t, r.profileErr)
	// the engine looks up the organization with the default configuration while it initializes, which is not the teardown
	defaultLog.reset()

	_ = r.tearDown(context.Background(), nil, nil, time.Now(), networking.UserAgentInfo{}, r.engine.GetAnalytics())

	assert.Empty(t, defaultLog.all(), "nothing goes to the host of the default profile")
	reports := workLog.posts()
	require.NotEmpty(t, reports, "the report goes to the host of the requested profile")
	for _, authorization := range reports {
		assert.Equal(t, "token work-token", authorization)
	}
}

// testOrgID is an organization id, which GAF accepts as it is. A slug would be looked up through the API.
const testOrgID = "11111111-2222-3333-4444-555555555555"

// (f) The flags are bound on the configuration of the run before the selection, as execute does, and at the command after
// it, as runMainWorkflow does. The selected configuration sees the values of both. The values set on the default
// configuration before the selection do not carry over: only its registrations do.
func Test_selectProfile_flagsAndStartupValues(t *testing.T) {
	setup := func(t *testing.T) (*cliRun, configuration.Configuration) {
		t.Helper()
		profileDir := t.TempDir()
		writeProfile(t, profileDir, "work", "work-token")
		base := configuration.NewWithOpts(configuration.WithSupportedEnvVarPrefixes("snyk_", "internal_", "test_"))
		base.Set(profile.DirKey, profileDir)
		initApplicationConfiguration(base)
		root := getGlobalFLags()
		require.NoError(t, root.Parse([]string{"--" + profileFlag + "=work", "--org=" + testOrgID, "--debug", "--" + basic_workflows.PROXY_NOAUTH}))
		require.NoError(t, base.AddFlagSet(root))
		engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))
		logger := zerolog.New(os.Stderr).Level(zerolog.Disabled)
		r := &cliRun{engine: engine, config: base, logger: &logger, profileName: base.GetString(profile.ConfigKey)}
		initRun(t, r)
		r.selectProfile()
		require.NoError(t, r.profileErr)
		return r, base
	}

	t.Run("the flags bound before the selection reach the profile", func(t *testing.T) {
		r, base := setup(t)
		config := r.config

		assert.NotSame(t, base, config)
		assert.Equal(t, testOrgID, config.GetString(configuration.ORGANIZATION))
		assert.True(t, config.GetBool(configuration.DEBUG))
		assert.True(t, config.GetBool(basic_workflows.PROXY_NOAUTH))
		assert.Equal(t, "work-token", config.GetString(configuration.AUTHENTICATION_TOKEN))
	})

	t.Run("the flags bound at the command after the selection reach the profile", func(t *testing.T) {
		r, base := setup(t)
		cmdFlags := pflag.NewFlagSet("command", pflag.ContinueOnError)
		cmdFlags.Bool("json", false, "")
		require.NoError(t, cmdFlags.Parse([]string{"--json"}))

		require.NoError(t, r.config.AddFlagSet(cmdFlags))

		assert.True(t, r.config.GetBool("json"))
		assert.False(t, base.GetBool("json"), "the default configuration does not get the command's flag")
	})

	t.Run("a value set on the default configuration before the selection does not carry over", func(t *testing.T) {
		profileDir := t.TempDir()
		writeProfile(t, profileDir, "work", "work-token")
		base := configuration.NewWithOpts()
		base.Set(profile.DirKey, profileDir)
		base.Set("internal_startup_value", "set-at-startup")
		engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))
		logger := zerolog.New(os.Stderr).Level(zerolog.Disabled)
		r := &cliRun{engine: engine, config: base, logger: &logger, profileName: "work"}
		initRun(t, r)

		r.selectProfile()

		require.NoError(t, r.profileErr)
		assert.Equal(t, "set-at-startup", base.GetString("internal_startup_value"))
		assert.Empty(t, r.config.GetString("internal_startup_value"))
	})

	t.Run("a default function registered on the default configuration before the selection carries over", func(t *testing.T) {
		profileDir := t.TempDir()
		writeProfile(t, profileDir, "work", "work-token")
		base := configuration.NewWithOpts()
		base.Set(profile.DirKey, profileDir)
		base.AddDefaultValue("internal_startup_default", configuration.StandardDefaultValueFunction(true))
		engine := app.CreateAppEngineWithOptions(app.WithConfiguration(base))
		logger := zerolog.New(os.Stderr).Level(zerolog.Disabled)
		r := &cliRun{engine: engine, config: base, logger: &logger, profileName: "work"}
		initRun(t, r)

		r.selectProfile()

		require.NoError(t, r.profileErr)
		assert.True(t, r.config.GetBool("internal_startup_default"))
	})
}

// (g) The preview feature flags are set on the configuration the run works on, which is the selected profile's.
func Test_applyStartupValues_setsThePreviewFlagsOfTheSelectedProfile(t *testing.T) {
	profileDir := t.TempDir()
	writeProfileValues(t, profileDir, "work", map[string]any{configuration.PREVIEW_FEATURES_ENABLED: true})
	r, base := newProfileRun(t, profileDir)
	r.profileName = "work"
	r.selectProfile()
	require.NoError(t, r.profileErr)

	applyStartupValues(r.config)

	assert.True(t, r.config.GetBool(utils.FF_FILE_FILTER_METACHARACTER_FIX))
	assert.True(t, r.config.GetBool(utils.FF_GITIGNORE_RESPECT_TRACKED_FILES))
	assert.False(t, base.IsSet(utils.FF_FILE_FILTER_METACHARACTER_FIX), "the default configuration is not changed")
}

// Test_execute_theProfileOfTheRunIsSelected drives the startup of the CLI: the profile is selected after the engine is
// initialized, because the registry of the profiles belongs to the engine. The profile is read from its own directory,
// and the developer's configuration is not used.
func Test_execute_theProfileOfTheRunIsSelected(t *testing.T) {
	profileDir := t.TempDir()
	writeProfile(t, profileDir, "work", "work-token")
	t.Setenv("HOME", t.TempDir())
	t.Setenv("SNYK_CONFIG_PROFILE_DIR", profileDir)
	// an environment token applies to every profile, see selectProfile, so it is cleared to read the token of the profile
	t.Setenv("SNYK_TOKEN", "")
	require.NoError(t, os.Unsetenv("SNYK_TOKEN"))

	oldArgs := append([]string{}, os.Args...)
	os.Args = []string{"snyk", "--" + profileFlag + "=work", "--help"}
	defer func() { os.Args = oldArgs }()

	r, _ := execute(nil)

	require.NoError(t, r.profileErr, "the profile is selected, the engine supports profiles at that point")
	assert.Equal(t, "work-token", r.config.GetString(configuration.AUTHENTICATION_TOKEN))
}

// Test_execute_aFailedEngineInitDoesNotSelectTheProfile: when the engine fails to initialize, the run is an error about
// the engine. The profile is not selected, so the run keeps its default configuration and reports no profile problem.
func Test_execute_aFailedEngineInitDoesNotSelectTheProfile(t *testing.T) {
	profileDir := t.TempDir()
	writeProfile(t, profileDir, "work", "work-token")
	t.Setenv("HOME", t.TempDir())
	t.Setenv("SNYK_CONFIG_PROFILE_DIR", profileDir)
	// an environment token applies to every profile, see selectProfile, so it is cleared to read the token of the profile
	t.Setenv("SNYK_TOKEN", "")
	require.NoError(t, os.Unsetenv("SNYK_TOKEN"))

	oldArgs := append([]string{}, os.Args...)
	os.Args = []string{"snyk", "--" + profileFlag + "=work", "--help"}
	defer func() { os.Args = oldArgs }()

	failingExt := func(workflow.Engine) error { return fmt.Errorf("extension failed to initialize") }

	r, exitCode := execute([]workflow.ExtensionInit{failingExt})

	assert.Equal(t, constants.SNYK_EXIT_CODE_ERROR, exitCode)
	require.NoError(t, r.profileErr, "a failed engine init is not reported as a profile problem")
	assert.NotEqual(t, "work-token", r.config.GetString(configuration.AUTHENTICATION_TOKEN), "the profile is not selected")
}
