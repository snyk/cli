package core

import (
	"context"
	"os"
	"os/exec"
	"path/filepath"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/configuration"
	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/mocks"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
)

func Test_shallSendInstrumentation(t *testing.T) {
	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	instrumentor := analytics.NewInstrumentationCollector()

	// case: nothing configured
	actual := shallSendInstrumentation(config, instrumentor)
	assert.True(t, actual)

	// case: any command called from an IDE
	config.Set(configuration.INTEGRATION_NAME, "VS_CODE")
	actual = shallSendInstrumentation(config, instrumentor)
	assert.False(t, actual)

	// case: analytics report command called from an IDE
	instrumentor.SetCategory([]string{"analytics", "report", "inputData"})
	actual = shallSendInstrumentation(config, instrumentor)
	assert.False(t, actual)
}

func Test_sendInstrumentation_passesEngineConfigurationToInstrumentationObject(t *testing.T) {
	globalConfiguration = configuration.NewWithOpts(configuration.WithAutomaticEnv())

	mockController := gomock.NewController(t)
	mockEngine := mocks.NewMockEngine(mockController)

	// Mirrors production: populateRedactionTerms runs at startup and sweeps up any
	// os.Environ() value it doesn't recognize. The client machine id is real Studio
	// data, not a secret, so its own env var value must not end up in the terms
	// this test's later scrub pass redacts against.
	machineId := "studio-device-id-abc12345"
	t.Setenv("INTERNAL_SNYK_CLIENT_MACHINE_ID", machineId)
	engineConfig := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	mockEngine.EXPECT().GetWorkflows().Return([]workflow.Identifier{})
	populateRedactionTerms(engineConfig, mockEngine)

	// One call from shallSendInstrumentation, one to derive analytics.WithConfiguration.
	// If the call site regresses to only passing WithLogger, this expectation goes unmet.
	mockEngine.EXPECT().GetConfiguration().Return(engineConfig).Times(2)
	mockEngine.EXPECT().Invoke(localworkflows.WORKFLOWID_REPORT_ANALYTICS, gomock.Any(), gomock.Any()).Return(nil, nil)

	instrumentor := analytics.NewInstrumentationCollector()
	addClientMachineId(instrumentor, engineConfig)
	logger := zerolog.Nop()

	sendInstrumentation(context.Background(), mockEngine, instrumentor, &logger)

	// sendInstrumentation just ran the extension through the same scrub chokepoint;
	// re-deriving the object (a pure read, doesn't mutate the collector) proves the
	// machine id survived it rather than coming back "***".
	obj, err := analytics.GetV2InstrumentationObject(instrumentor, analytics.WithConfiguration(engineConfig))
	assert.NoError(t, err)
	assert.Equal(t, machineId, (*obj.Data.Attributes.Interaction.Extension)["studio::client_machine_id"])
}

func Test_addClientMachineId(t *testing.T) {
	t.Run("emits studio::client_machine_id when INTERNAL_SNYK_CLIENT_MACHINE_ID env var is set", func(t *testing.T) {
		// Mirrors how Studio sets the env var before exec'ing the snyk binary
		// (studio-internal/.../scan_worker.py: env["INTERNAL_SNYK_CLIENT_MACHINE_ID"] = _machine_id)
		// and the prod config in cliv2/pkg/core/main.go uses WithSupportedEnvVarPrefixes("snyk_", "internal_", ...)
		t.Setenv("INTERNAL_SNYK_CLIENT_MACHINE_ID", "studio-device-id-abc")
		config := configuration.NewWithOpts(
			configuration.WithSupportedEnvVarPrefixes("snyk_", "internal_", "test_"),
		)
		instrumentor := analytics.NewInstrumentationCollector()

		addClientMachineId(instrumentor, config)

		obj, err := analytics.GetV2InstrumentationObject(instrumentor)
		assert.NoError(t, err)
		assert.NotNil(t, obj.Data.Attributes.Interaction.Extension)
		assert.Equal(t, "studio-device-id-abc", (*obj.Data.Attributes.Interaction.Extension)["studio::client_machine_id"])
	})

	t.Run("emits studio::client_machine_id when config key is set directly", func(t *testing.T) {
		config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		config.Set("internal_snyk_client_machine_id", "test-machine-123")
		instrumentor := analytics.NewInstrumentationCollector()

		addClientMachineId(instrumentor, config)

		obj, err := analytics.GetV2InstrumentationObject(instrumentor)
		assert.NoError(t, err)
		assert.NotNil(t, obj.Data.Attributes.Interaction.Extension)
		assert.Equal(t, "test-machine-123", (*obj.Data.Attributes.Interaction.Extension)["studio::client_machine_id"])
	})

	t.Run("omits studio::client_machine_id when env var and config are empty", func(t *testing.T) {
		config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		instrumentor := analytics.NewInstrumentationCollector()

		addClientMachineId(instrumentor, config)

		obj, err := analytics.GetV2InstrumentationObject(instrumentor)
		assert.NoError(t, err)
		if obj.Data.Attributes.Interaction.Extension != nil {
			_, present := (*obj.Data.Attributes.Interaction.Extension)["studio::client_machine_id"]
			assert.False(t, present)
		}
	})
}

// gitProvenanceKeys are the extension keys addGitProvenance may emit.
var gitProvenanceKeys = []string{"git.tree_hash", "git.repository_name", "git.current_commit", "git.current_branch"}

func Test_addGitProvenance(t *testing.T) {
	t.Run("omits git provenance when INPUT_DIRECTORY is empty", func(t *testing.T) {
		// The empty-path guard: an empty path must not fall through to the
		// process working directory and attach an unrelated repo's provenance.
		config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		instrumentor := analytics.NewInstrumentationCollector()

		addGitProvenance(instrumentor, config)

		assertNoGitProvenance(t, instrumentor)
	})

	t.Run("omits git provenance when INPUT_DIRECTORY is not a git repository", func(t *testing.T) {
		config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		config.Set(configuration.INPUT_DIRECTORY, t.TempDir())
		instrumentor := analytics.NewInstrumentationCollector()

		addGitProvenance(instrumentor, config)

		assertNoGitProvenance(t, instrumentor)
	})

	t.Run("emits git provenance for a git repository", func(t *testing.T) {
		dir := initGitRepo(t, "https://github.com/snyk/my-repo.git", "main")

		config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		config.Set(configuration.INPUT_DIRECTORY, dir)
		instrumentor := analytics.NewInstrumentationCollector()

		addGitProvenance(instrumentor, config)

		obj, err := analytics.GetV2InstrumentationObject(instrumentor)
		require.NoError(t, err)
		ext := obj.Data.Attributes.Interaction.Extension
		require.NotNil(t, ext)
		assert.NotEmpty(t, (*ext)["git.tree_hash"])
		assert.Equal(t, "my-repo", (*ext)["git.repository_name"])
		assert.NotEmpty(t, (*ext)["git.current_commit"])
		assert.Equal(t, "main", (*ext)["git.current_branch"])
	})
}

func assertNoGitProvenance(t *testing.T, instrumentor analytics.InstrumentationCollector) {
	t.Helper()
	obj, err := analytics.GetV2InstrumentationObject(instrumentor)
	require.NoError(t, err)
	if obj.Data.Attributes.Interaction.Extension == nil {
		return
	}
	for _, key := range gitProvenanceKeys {
		_, present := (*obj.Data.Attributes.Interaction.Extension)[key]
		assert.Falsef(t, present, "expected %q to be absent", key)
	}
}

// initGitRepo builds a throwaway git repo with one commit, the given remote and
// branch, so addGitProvenance has a real repository to derive provenance from.
func initGitRepo(t *testing.T, remoteURL, branch string) string {
	t.Helper()
	if _, err := exec.LookPath("git"); err != nil {
		t.Skip("git binary not available")
	}

	dir := t.TempDir()
	runGit := func(args ...string) {
		cmd := exec.Command("git", args...)
		cmd.Dir = dir
		// Keep the local user's global/system git config out of the test.
		cmd.Env = append(os.Environ(),
			"GIT_CONFIG_GLOBAL=/dev/null",
			"GIT_CONFIG_SYSTEM=/dev/null",
			"GIT_AUTHOR_NAME=test",
			"GIT_AUTHOR_EMAIL=test@example.com",
			"GIT_COMMITTER_NAME=test",
			"GIT_COMMITTER_EMAIL=test@example.com",
		)
		out, err := cmd.CombinedOutput()
		require.NoErrorf(t, err, "git %v failed: %s", args, out)
	}

	runGit("init")
	runGit("checkout", "-b", branch)
	require.NoError(t, os.WriteFile(filepath.Join(dir, "file.txt"), []byte("hello"), 0o600))
	runGit("add", ".")
	runGit("-c", "commit.gpgsign=false", "commit", "-m", "initial commit")
	runGit("remote", "add", "origin", remoteURL)

	return dir
}
