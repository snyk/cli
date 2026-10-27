package core

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"io/fs"
	"os"
	"os/exec"
	"path/filepath"
	"strings"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/rs/zerolog"
	"github.com/snyk/error-catalog-golang-public/code"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/apiclients/testapi"
	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/configuration"
	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/local_workflows/content_type"
	"github.com/snyk/go-application-framework/pkg/local_workflows/json_schemas"
	"github.com/snyk/go-application-framework/pkg/local_workflows/local_models"
	"github.com/snyk/go-application-framework/pkg/local_workflows/output_workflow"
	"github.com/snyk/go-application-framework/pkg/logging"
	"github.com/snyk/go-application-framework/pkg/mocks"
	"github.com/snyk/go-application-framework/pkg/networking"
	"github.com/snyk/go-application-framework/pkg/utils/ufm"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/cli/cliv2/internal/helpdocs"
	"github.com/snyk/cli/cliv2/internal/helprouting"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	clierrors "github.com/snyk/cli/cliv2/internal/errors"
	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
)

// newTestRun returns what a run of the CLI works on, with a quiet logger. Tests set the configuration and the
// engine they need.
func newTestRun() *cliRun {
	logger := zerolog.New(io.Discard)
	return &cliRun{logger: &logger}
}

func Test_configureSarifEqualJSON_IncludesHTMLFileWriter(t *testing.T) {
	config := configuration.NewWithOpts()

	configureSarifEqualJSON(config)

	writers, ok := config.Get(output_workflow.OUTPUT_CONFIG_KEY_FILE_WRITERS).([]output_workflow.FileWriter)
	require.True(t, ok)
	require.Len(t, writers, 3)
	assert.Equal(t, output_workflow.OUTPUT_CONFIG_KEY_HTML_FILE, writers[2].NameConfigKey)
	assert.Equal(t, output_workflow.HTML_MIME_TYPE, writers[2].MimeType)
	assert.Empty(t, writers[2].TemplateFiles)
}

func Test_isHtmlOutput(t *testing.T) {
	testCases := []struct {
		name     string
		args     []string
		expected bool
	}{
		{name: "no html flags", args: []string{}, expected: false},
		{name: "--html", args: []string{"--html"}, expected: true},
		{name: "--html=false", args: []string{"--html=false"}, expected: false},
		{name: "--html-file-output", args: []string{"--html-file-output=report.html"}, expected: true},
		{name: "--json", args: []string{"--json"}, expected: false},
	}

	for _, tc := range testCases {
		t.Run(tc.name, func(t *testing.T) {
			flags := pflag.NewFlagSet("test", pflag.ContinueOnError)
			flags.Bool(output_workflow.OUTPUT_CONFIG_KEY_HTML, false, "")
			flags.String(output_workflow.OUTPUT_CONFIG_KEY_HTML_FILE, "", "")
			flags.Bool(output_workflow.OUTPUT_CONFIG_KEY_JSON, false, "")
			require.NoError(t, flags.Parse(tc.args))

			assert.Equal(t, tc.expected, isHtmlOutput(flags))
		})
	}
}

func Test_mainWithErrorCode(t *testing.T) {
	oldArgs := append([]string{}, os.Args...)
	os.Args = []string{"snyk", "--version"}
	defer func() { os.Args = oldArgs }()

	r, errCode := execute(nil)
	assert.False(t, r.config.GetBool(configuration.CONFIG_CACHE_DISABLED))
	assert.Equal(t, configuration.NoCacheExpiration, r.config.GetDuration(configuration.CONFIG_CACHE_TTL))

	assert.Equal(t, 0, errCode)

	t.Run("outputs an error list", func(t *testing.T) {
		t.Setenv("SNYK_TOKEN", "invalidToken")
		oldArgs := append([]string{}, os.Args...)
		os.Args = []string{"snyk", "whoami", "--experimental"}
		defer func() {
			os.Args = oldArgs
		}()

		errCode := mainWithErrorCode(nil)
		assert.Equal(t, 2, errCode)
	})
}

func Test_populateRedactionTerms(t *testing.T) {
	mockController := gomock.NewController(t)
	mockEngine := mocks.NewMockEngine(mockController)
	mockEngine.EXPECT().GetWorkflows().Return(nil)

	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	t.Setenv("SNYK_TEST_REDACTION_MARKER", "unmistakably-secret-value")

	// No debugEnabled anywhere in this call: populateRedactionTerms runs
	// unconditionally at its call site, so proving it sets config here proves
	// the behavior holds regardless of debugEnabled.
	terms := populateRedactionTerms(config, mockEngine)

	assert.Contains(t, terms, "unmistakably-secret-value")
	assert.Equal(t, terms, config.GetStringSlice(logging.REDACTION_TERMS))
}

func Test_populateRedactionTerms_excludesClientMachineId(t *testing.T) {
	mockController := gomock.NewController(t)
	mockEngine := mocks.NewMockEngine(mockController)
	mockEngine.EXPECT().GetWorkflows().Return(nil)

	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	machineId := "studio-device-id-abc12345"
	t.Setenv("INTERNAL_SNYK_CLIENT_MACHINE_ID", machineId)

	terms := populateRedactionTerms(config, mockEngine)

	assert.NotContains(t, terms, machineId, "client machine id must never be swept into REDACTION_TERMS, or the analytics scrub chokepoint strips it right back out of its own extension")
}

func newAppEngineForRedactionTerms(t *testing.T) (configuration.Configuration, workflow.Engine) {
	t.Helper()
	config := configuration.NewWithOpts(configuration.WithSupportedEnvVarPrefixes("snyk_", "internal_", "test_"))
	engine := app.CreateAppEngineWithOptions(app.WithConfiguration(config))
	// Replaces the application defaults, which look the organization up over the network.
	config.AddDefaultValue(configuration.ORGANIZATION, configuration.StandardDefaultValueFunction(""))
	config.AddDefaultValue(configuration.ORGANIZATION_SLUG, configuration.StandardDefaultValueFunction(""))
	return config, engine
}

func populateRedactionTermsWithSuppliedMachineID(t *testing.T, machineID string) []string {
	t.Helper()
	t.Setenv("HOME", t.TempDir())
	t.Setenv("INTERNAL_SNYK_MACHINE_ID", machineID)
	config, engine := newAppEngineForRedactionTerms(t)
	return populateRedactionTerms(config, engine)
}

func Test_populateRedactionTerms_doesNotCreateMachineIdFileWithoutSuppliedMachineId(t *testing.T) {
	home := t.TempDir()
	t.Setenv("HOME", home)
	t.Setenv("LOCALAPPDATA", home)
	t.Setenv("ProgramData", home)
	t.Setenv("INTERNAL_SNYK_MACHINE_ID", "")
	require.NoError(t, os.Unsetenv("INTERNAL_SNYK_MACHINE_ID"))
	config, engine := newAppEngineForRedactionTerms(t)

	populateRedactionTerms(config, engine)

	var machineIDFiles []string
	require.NoError(t, filepath.WalkDir(home, func(path string, d fs.DirEntry, err error) error {
		if err == nil && d.Name() == "machine-id.json" {
			machineIDFiles = append(machineIDFiles, path)
		}
		return err
	}))
	assert.Empty(t, machineIDFiles, "building redaction terms must not resolve the machine id, which creates a machine id file when none exists")
}

func Test_populateRedactionTerms_excludesValidSuppliedMachineId(t *testing.T) {
	machineID := "3f2504e0-4f89-41d3-9a0c-0305e82c3301"

	terms := populateRedactionTermsWithSuppliedMachineID(t, machineID)

	assert.NotContains(t, terms, machineID, "a machine id the application accepted must not be redacted, or the debug log header shows it as ***")
}

func Test_populateRedactionTerms_redactsInvalidSuppliedMachineId(t *testing.T) {
	invalid := "sk_live/Secret+Token"

	terms := populateRedactionTermsWithSuppliedMachineID(t, invalid)

	assert.Contains(t, terms, invalid, "a value the application rejected as a machine id is not shown as one, so it must stay redacted")
}

func Test_populateRedactionTerms_excludesIntegrationDetails(t *testing.T) {
	mockController := gomock.NewController(t)
	mockEngine := mocks.NewMockEngine(mockController)
	mockEngine.EXPECT().GetWorkflows().Return(nil)

	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	t.Setenv("SNYK_INTEGRATION_NAME", "custom-integration")
	t.Setenv("SNYK_INTEGRATION_VERSION", "custom-version")
	t.Setenv("SNYK_INTEGRATION_ENVIRONMENT", "custom-environment")
	t.Setenv("SNYK_INTEGRATION_ENVIRONMENT_VERSION", "custom-environment-version")

	terms := populateRedactionTerms(config, mockEngine)

	for _, term := range []string{"custom-integration", "custom-version", "custom-environment", "custom-environment-version"} {
		assert.NotContains(t, terms, term)
	}
}

func Test_populateRedactionTerms_excludesDetectedAgent(t *testing.T) {
	// Not on agent.canonicalAgent's short-circuit list, so AI_AGENT is trusted
	// verbatim into the persona.agent extension. GetUnknownParameters
	// tokenizes its input on whitespace, so a multi-word value only survives
	// unredacted if each of its words is excluded too, not just the joined
	// string as a whole.
	cases := []struct {
		name      string
		agent     string
		wantWords []string
	}{
		{
			name:      "single word",
			agent:     "some-unlisted-harness",
			wantWords: []string{"some-unlisted-harness"},
		},
		{
			name:      "words with spaces",
			agent:     "My Custom Harness",
			wantWords: []string{"My", "Custom", "Harness"},
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			mockController := gomock.NewController(t)
			mockEngine := mocks.NewMockEngine(mockController)
			mockEngine.EXPECT().GetWorkflows().Return(nil)

			config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
			t.Setenv("AI_AGENT", tc.agent)

			terms := populateRedactionTerms(config, mockEngine)

			for _, word := range tc.wantWords {
				assert.NotContains(t, terms, word, "a caller-declared AI_AGENT value must never be swept into REDACTION_TERMS, or the analytics scrub chokepoint strips it right back out of the persona.agent extension")
			}
		})
	}
}

func Test_populateRedactionTerms_excludesCanonicalAgentNameAndVersion(t *testing.T) {
	mockController := gomock.NewController(t)
	mockEngine := mocks.NewMockEngine(mockController)
	mockEngine.EXPECT().GetWorkflows().Return(nil)

	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	// The raw value splits into the canonical "claude_code" and "2.1.310", which is what
	// persona.Report puts into the extension. Another variable carrying either value must
	// not turn it into a redaction term.
	t.Setenv("AI_AGENT", "claude-code_2-1-310_agent")
	t.Setenv("TEST_WRAPPER_AGENT", "claude_code")
	t.Setenv("TEST_WRAPPER_AGENT_VERSION", "2.1.310")

	terms := populateRedactionTerms(config, mockEngine)

	assert.NotContains(t, terms, "claude_code", "the canonical agent name reported in persona.agent must not be redacted")
	assert.NotContains(t, terms, "2.1.310", "the agent version reported in persona.agent_version must not be redacted")
}

func Test_initApplicationConfiguration_DisablesAnalytics(t *testing.T) {
	t.Run("via SNYK_DISABLE_ANALYTICS (true)", func(t *testing.T) {
		c := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		assert.False(t, c.GetBool(configuration.ANALYTICS_DISABLED))

		c.Set("SNYK_DISABLE_ANALYTICS", "true")
		initApplicationConfiguration(c)

		assert.True(t, c.GetBool(configuration.ANALYTICS_DISABLED))
	})
	t.Run("via SNYK_DISABLE_ANALYTICS (1)", func(t *testing.T) {
		c := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		assert.False(t, c.GetBool(configuration.ANALYTICS_DISABLED))

		c.Set("SNYK_DISABLE_ANALYTICS", "1")
		initApplicationConfiguration(c)

		assert.True(t, c.GetBool(configuration.ANALYTICS_DISABLED))
	})
	t.Run("via SNYK_CFG_DISABLE_ANALYTICS (true)", func(t *testing.T) {
		c := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		assert.False(t, c.GetBool(configuration.ANALYTICS_DISABLED))

		c.Set("SNYK_CFG_DISABLE_ANALYTICS", "true")
		initApplicationConfiguration(c)

		assert.True(t, c.GetBool(configuration.ANALYTICS_DISABLED))
	})
	t.Run("via SNYK_CFG_DISABLE_ANALYTICS (1)", func(t *testing.T) {
		c := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		assert.False(t, c.GetBool(configuration.ANALYTICS_DISABLED))

		c.Set("SNYK_CFG_DISABLE_ANALYTICS", "1")
		initApplicationConfiguration(c)

		assert.True(t, c.GetBool(configuration.ANALYTICS_DISABLED))
	})
	t.Run("via DISABLE-ANALYTICS (true)", func(t *testing.T) {
		c := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		assert.False(t, c.GetBool(configuration.ANALYTICS_DISABLED))

		c.Set("disable-analytics", "true")
		initApplicationConfiguration(c)

		assert.True(t, c.GetBool(configuration.ANALYTICS_DISABLED))
	})
	t.Run("via DISABLE-ANALYTICS (1)", func(t *testing.T) {
		c := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		assert.False(t, c.GetBool(configuration.ANALYTICS_DISABLED))

		c.Set("disable-analytics", "1")
		initApplicationConfiguration(c)

		assert.True(t, c.GetBool(configuration.ANALYTICS_DISABLED))
	})
}

func Test_CreateCommandsForWorkflowWithSubcommands(t *testing.T) {
	r := newTestRun()

	r.config = configuration.New()
	r.config.Set(configuration.DEBUG, true)
	r.engine = workflow.NewWorkFlowEngine(r.config)

	fn := func(invocation workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
		return []workflow.Data{}, nil
	}

	// setup workflow engine to contain a workflow with subcommands
	commandList := []string{"output", "cmd2 something", "cmd subcmd1 subcmd2", "cmd subcmd1 subcmd3", "cmd"}
	for _, v := range commandList {
		workflowConfig := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("pla", pflag.ContinueOnError))
		workflowId1 := workflow.NewWorkflowIdentifier(v)
		_, err := r.engine.Register(workflowId1, workflowConfig, fn)
		assert.NoError(t, err)
	}

	_ = r.engine.Init()
	rootCommand := r.prepareRootCommand(testHelpRouter())

	// invoke method under test
	r.createCommandsForWorkflows(rootCommand)

	// test that root subcmd2 has expected subcommands
	cmd, _, _ := rootCommand.Find([]string{"cmd"})
	subcmd1, _, _ := rootCommand.Find([]string{"cmd", "subcmd1"})
	subcmd2, _, _ := rootCommand.Find([]string{"cmd", "subcmd1", "subcmd2"})
	subcmd3, _, _ := rootCommand.Find([]string{"cmd", "subcmd1", "subcmd3"})
	cmd2, _, _ := rootCommand.Find([]string{"cmd2"})
	something, _, _ := rootCommand.Find([]string{"cmd2", "something"})
	parseError := cmd.ParseFlags([]string{"cmd", "--unknown"})

	// test which command triggers a handleError() and which not
	assert.Equal(t, handleErrorUnhandled, r.handleError(cmd.RunE(cmd, []string{})))
	assert.Equal(t, handleErrorUnhandled, r.handleError(subcmd2.RunE(subcmd2, []string{})))
	assert.Equal(t, handleErrorUnhandled, r.handleError(subcmd3.RunE(subcmd3, []string{})))
	assert.Equal(t, handleErrorUnhandled, r.handleError(something.RunE(something, []string{})))
	assert.Equal(t, handleErrorFallbackToLegacyCLI, r.handleError(subcmd1.RunE(subcmd1, []string{})))
	assert.Equal(t, handleErrorFallbackToLegacyCLI, r.handleError(cmd2.RunE(cmd2, []string{})))
	assert.Equal(t, handleErrorShowHelp, r.handleError(parseError))

	assert.True(t, subcmd1.DisableFlagParsing)
	assert.False(t, subcmd2.DisableFlagParsing)

	assert.False(t, subcmd2.HasSubCommands())
	assert.Equal(t, "subcmd2", subcmd2.Name())
	assert.False(t, subcmd3.Hidden)

	assert.False(t, subcmd3.HasSubCommands())
	assert.Equal(t, "subcmd3", subcmd3.Name())
	assert.False(t, subcmd3.Hidden)

	assert.True(t, cmd2.HasSubCommands())
	assert.Equal(t, "cmd2", cmd2.Name())
	assert.True(t, cmd2.Hidden)
}

// setupMainWorkflowTestEnv wires up the engine and configuration that runMainWorkflow needs and
// returns the run and a command.
func setupMainWorkflowTestEnv(t *testing.T) (*cliRun, *cobra.Command) {
	t.Helper()

	r := newTestRun()

	r.config = configuration.New()
	r.config.Set(configuration.DEBUG, true)
	r.engine = workflow.NewWorkFlowEngine(r.config)

	noopWorkflow := func(workflow.InvocationContext, []workflow.Data) ([]workflow.Data, error) {
		return []workflow.Data{}, nil
	}
	for _, name := range []string{"command", localworkflows.WORKFLOWID_OUTPUT_WORKFLOW.Host} {
		opts := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("pla", pflag.ContinueOnError))
		_, err := r.engine.Register(workflow.NewWorkflowIdentifier(name), opts, noopWorkflow)
		require.NoError(t, err)
	}
	require.NoError(t, localworkflows.InitDataTransformationWorkflow(r.engine))
	_ = r.engine.Init()
	require.NoError(t, localworkflows.InitFilterFindingsWorkflow(r.engine))

	cmd := &cobra.Command{Use: "command"}
	cmd.SetContext(t.Context())
	return r, cmd
}

// Test_runMainWorkflow_inputDirectoryParsing is the CLI-1631 regression coverage. It asserts how
// positional paths and "--" passthrough args map onto INPUT_DIRECTORY and UNKNOWN_ARGS. The key
// invariant: passthrough tokens after "--" must never leak into INPUT_DIRECTORY (which would make
// the downstream flow router misread them as package names and force the legacy, no-Risk-Score flow),
// regardless of the path shape. wantInputDirs == nil means INPUT_DIRECTORY must be left unset so it
// later defaults to the working directory.
func Test_runMainWorkflow_inputDirectoryParsing(t *testing.T) {
	tests := map[string]struct {
		positionalArgs  []string
		rawArgs         []string
		wantInputDirs   []string
		wantUnknownArgs []string
	}{
		"path with -- passthrough, current dir": {
			positionalArgs:  []string{".", "-s", "settings.xml"},
			rawArgs:         []string{"snyk", "test", ".", "--", "-s", "settings.xml"},
			wantInputDirs:   []string{"."},
			wantUnknownArgs: []string{"-s", "settings.xml"},
		},
		"path with -- passthrough, relative": {
			positionalArgs:  []string{"sub/project", "-s", "settings.xml"},
			rawArgs:         []string{"snyk", "test", "sub/project", "--", "-s", "settings.xml"},
			wantInputDirs:   []string{"sub/project"},
			wantUnknownArgs: []string{"-s", "settings.xml"},
		},
		"path with -- passthrough, absolute": {
			positionalArgs:  []string{"/home/user/project", "-s", "settings.xml"},
			rawArgs:         []string{"snyk", "test", "/home/user/project", "--", "-s", "settings.xml"},
			wantInputDirs:   []string{"/home/user/project"},
			wantUnknownArgs: []string{"-s", "settings.xml"},
		},
		"only -- passthrough, no path": {
			positionalArgs:  []string{"-s", "settings.xml"},
			rawArgs:         []string{"snyk", "test", "--", "-s", "settings.xml"},
			wantInputDirs:   nil,
			wantUnknownArgs: []string{"-s", "settings.xml"},
		},
		"no --, single path": {
			positionalArgs: []string{"."},
			rawArgs:        []string{"snyk", "test", "."},
			wantInputDirs:  []string{"."},
		},
		"no --, multiple paths": {
			positionalArgs: []string{"dir1", "dir2"},
			rawArgs:        []string{"snyk", "test", "dir1", "dir2"},
			wantInputDirs:  []string{"dir1", "dir2"},
		},
		"bare command, no path no --": {
			positionalArgs: []string{},
			rawArgs:        []string{"snyk", "test"},
			wantInputDirs:  nil,
		},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {
			r, cmd := setupMainWorkflowTestEnv(t)

			require.NoError(t, r.runMainWorkflow(cmd, tc.positionalArgs, tc.rawArgs))

			config := r.config

			if tc.wantInputDirs == nil {
				assert.Nil(t, config.Get(configuration.INPUT_DIRECTORY),
					"INPUT_DIRECTORY must be left unset so it defaults to the working directory")
			} else {
				assert.Equal(t, tc.wantInputDirs, config.GetStringSlice(configuration.INPUT_DIRECTORY),
					"passthrough args after -- must not leak into INPUT_DIRECTORY")
			}

			if len(tc.wantUnknownArgs) == 0 {
				assert.Empty(t, config.GetStringSlice(configuration.UNKNOWN_ARGS))
			} else {
				assert.Equal(t, tc.wantUnknownArgs, config.GetStringSlice(configuration.UNKNOWN_ARGS))
			}
		})
	}
}

func Test_getErrorFromWorkFlowData(t *testing.T) {
	engine := workflow.NewWorkFlowEngine(configuration.New())
	assert.NoError(t, engine.Init())

	ufmTestResultNothing, err := ufm.NewSerializableTestResultFromBytes([]byte(`[{"testId": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "findings": []}]`))
	assert.NoError(t, err)
	ufmDataNothing := ufm.CreateWorkflowDataFromTestResults(workflow.NewWorkflowIdentifier("test"), ufmTestResultNothing)

	ufmTestResultFail, err := ufm.NewSerializableTestResultFromBytes([]byte(`[{"testId": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "passFail": "` + testapi.Pass + `", "findings": []}, {"testId": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "passFail": "` + testapi.Fail + `", "findings": []}]`))
	assert.NoError(t, err)
	ufmDataFail := ufm.CreateWorkflowDataFromTestResults(workflow.NewWorkflowIdentifier("test"), ufmTestResultFail)

	ufmTestResultPass, err := ufm.NewSerializableTestResultFromBytes([]byte(`[{"testId": "f47ac10b-58cc-4372-a567-0e02b2c3d479", "passFail": "` + testapi.Pass + `", "findings": []}]`))
	assert.NoError(t, err)
	ufmDataPass := ufm.CreateWorkflowDataFromTestResults(workflow.NewWorkflowIdentifier("test"), ufmTestResultPass)

	testSummaryBytesFail, err := json.Marshal(json_schemas.TestSummary{
		Results: []json_schemas.TestSummaryResult{{
			Severity: "critical",
			Total:    99,
			Open:     97,
			Ignored:  2,
		}},
		Type: "sast",
	})
	assert.Nil(t, err)
	testSummaryDataFail := workflow.NewData(workflow.NewTypeIdentifier(workflow.NewWorkflowIdentifier("output"), "output"), content_type.TEST_SUMMARY, testSummaryBytesFail)

	testSummaryBytesPass, err := json.Marshal(json_schemas.TestSummary{
		Results: []json_schemas.TestSummaryResult{{
			Severity: "critical",
			Total:    0,
			Open:     0,
			Ignored:  0,
		}},
		Type: "sast",
	})
	assert.Nil(t, err)
	testSummaryDataPass := workflow.NewData(workflow.NewTypeIdentifier(workflow.NewWorkflowIdentifier("output"), "output"), content_type.TEST_SUMMARY, testSummaryBytesPass)

	t.Run("Nil data = no exit code", func(t *testing.T) {
		tErr := getErrorFromWorkFlowData(engine, nil)
		assert.NoError(t, tErr)
	})
	t.Run("Unhandled data = no exit code", func(t *testing.T) {
		workflowId := workflow.NewWorkflowIdentifier("output")
		workflowIdentifier := workflow.NewTypeIdentifier(workflowId, "output")
		data := workflow.NewData(workflowIdentifier, "application/json", []byte(`{"error": "test error"}`))
		tErr := getErrorFromWorkFlowData(engine, []workflow.Data{nil, data})
		assert.NoError(t, tErr)
	})
	t.Run("TestSummary with vulnerabilities = exit code 1", func(t *testing.T) {
		tErr := getErrorFromWorkFlowData(engine, []workflow.Data{nil, testSummaryDataFail})
		require.NotNil(t, tErr)
		var expectedError *clierrors.ErrorWithExitCode
		assert.ErrorAs(t, tErr, &expectedError)
		assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, expectedError.ExitCode)
	})

	t.Run("TestSummary with no vulnerabilities = exit code 0", func(t *testing.T) {
		tErr := getErrorFromWorkFlowData(engine, []workflow.Data{nil, testSummaryDataPass})
		assert.Nil(t, tErr)
	})

	t.Run("TestSummary without and UFM with vulnerabilities = exit code 1", func(t *testing.T) {
		tErr := getErrorFromWorkFlowData(engine, []workflow.Data{nil, testSummaryDataPass, ufmDataFail})
		assert.Error(t, tErr)
		var actualError *clierrors.ErrorWithExitCode
		assert.ErrorAs(t, tErr, &actualError)
		assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, actualError.ExitCode)
	})

	t.Run("TestSummary with unsupported project error annotation = exit code 3", func(t *testing.T) {
		workflowId := workflow.NewWorkflowIdentifier("output")
		workflowIdentifier := workflow.NewTypeIdentifier(workflowId, "output")
		d, tErr := json.Marshal(json_schemas.NewTestSummary("sast", "/path"))
		assert.Nil(t, tErr)
		data := workflow.NewData(workflowIdentifier, content_type.TEST_SUMMARY, d)
		expectedCodeErr := code.NewUnsupportedProjectError("")
		data.AddError(expectedCodeErr)
		tErr = getErrorFromWorkFlowData(engine, []workflow.Data{nil, data})

		var actualError *clierrors.ErrorWithExitCode
		var actualSnykCatalogError snyk_errors.Error
		assert.ErrorAs(t, tErr, &actualError)
		assert.ErrorAs(t, tErr, &actualSnykCatalogError)

		assert.Equal(t, expectedCodeErr, actualSnykCatalogError)
		assert.Equal(t, constants.SNYK_EXIT_CODE_UNSUPPORTED_PROJECTS, actualError.ExitCode)
	})

	t.Run("TestSummary with misc error annotation = exit code 0", func(t *testing.T) {
		workflowId := workflow.NewWorkflowIdentifier("output")
		workflowIdentifier := workflow.NewTypeIdentifier(workflowId, "output")
		d, tErr := json.Marshal(json_schemas.TestSummary{
			Results: []json_schemas.TestSummaryResult{{
				Severity: "critical",
				Total:    0,
				Open:     0,
				Ignored:  0,
			}},
			Artifacts: 0,
			Type:      "sast",
		})
		assert.Nil(t, tErr)
		data := workflow.NewData(workflowIdentifier, content_type.TEST_SUMMARY, d)
		data.AddError(code.NewAnalysisFileCountLimitExceededError(""))
		tErr = getErrorFromWorkFlowData(engine, []workflow.Data{nil, data})
		assert.NoError(t, tErr)
	})

	t.Run("Ufm with vulnerabilities = exit code 1", func(t *testing.T) {
		tErr := getErrorFromWorkFlowData(engine, []workflow.Data{nil, testSummaryDataFail, ufmDataPass, ufmDataFail})
		assert.Error(t, tErr)

		var actualError *clierrors.ErrorWithExitCode
		assert.ErrorAs(t, tErr, &actualError)
		assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, actualError.ExitCode)
	})

	t.Run("Ufm with no vulnerabilities = exit code 0", func(t *testing.T) {
		tErr := getErrorFromWorkFlowData(engine, []workflow.Data{nil, testSummaryDataFail, ufmDataPass})
		assert.NoError(t, tErr)
	})

	t.Run("Ufm without and TestSummary with vulnerabilities = exit code 1", func(t *testing.T) {
		tErr := getErrorFromWorkFlowData(engine, []workflow.Data{nil, testSummaryDataFail, ufmDataNothing})
		assert.Error(t, tErr)

		var actualError *clierrors.ErrorWithExitCode
		assert.ErrorAs(t, tErr, &actualError)
		assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, actualError.ExitCode)
	})
}

func Test_runWorkflowAndProcessData(t *testing.T) {
	r := newTestRun()
	r.config = configuration.New()
	r.config.Set(configuration.DEBUG, true)
	r.engine = workflow.NewWorkFlowEngine(r.config)

	testCmnd := "subcmd1"
	workflowId1 := workflow.NewWorkflowIdentifier("output")

	outputFn := func(invocation workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
		summaryPayload, _ := json.Marshal(json_schemas.TestSummary{
			Results: []json_schemas.TestSummaryResult{{
				Severity: "critical",
				Total:    99,
				Open:     97,
				Ignored:  2,
			}, {
				Severity: "medium",
				Total:    99,
				Open:     97,
				Ignored:  2,
			}},
			Type: "sast",
		})
		data := workflow.NewData(workflow.NewTypeIdentifier(workflowId1, "workflowData"), content_type.TEST_SUMMARY, summaryPayload)
		return []workflow.Data{
			data,
		}, nil
	}

	workflowConfig := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("pla", pflag.ContinueOnError))

	_, err := r.engine.Register(workflowId1, workflowConfig, outputFn)
	assert.NoError(t, err)
	// Register our data filter workflow
	err = localworkflows.InitFilterFindingsWorkflow(r.engine)
	assert.NoError(t, err)

	fn := func(invocation workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
		typeId := workflow.NewTypeIdentifier(invocation.GetWorkflowIdentifier(), "workflowData")
		testSummary := json_schemas.TestSummary{
			Results: []json_schemas.TestSummaryResult{
				{
					Severity: "critical",
					Total:    10,
					Open:     10,
					Ignored:  0,
				},
			},
			Type: "sast",
		}

		var d []byte
		d, err = json.Marshal(testSummary)
		assert.NoError(t, err)

		data := workflow.NewData(typeId, content_type.TEST_SUMMARY, d)
		return []workflow.Data{
			data,
		}, nil
	}

	// setup workflow engine to contain a workflow with subcommands
	wrkflowId := workflow.NewWorkflowIdentifier(testCmnd)

	entry, err := r.engine.Register(wrkflowId, workflowConfig, fn)
	assert.Nil(t, err)
	assert.NotNil(t, entry)

	// Register our data transformation workflow
	err = localworkflows.InitDataTransformationWorkflow(r.engine)
	assert.NoError(t, err)

	err = r.engine.Init()
	assert.NoError(t, err)

	// invoke method under test
	logger := zerolog.New(os.Stderr)
	err = runWorkflowAndProcessData(t.Context(), r.engine, &logger, testCmnd)

	var expectedError *clierrors.ErrorWithExitCode
	assert.ErrorAs(t, err, &expectedError)
	assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, expectedError.ExitCode)

	actualCode := cliv2.DeriveExitCode(err)
	assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, actualCode)
}

func Test_runWorkflowAndProcessData_with_Filtering(t *testing.T) {
	r := newTestRun()
	r.config = configuration.New()
	r.config.Set(configuration.DEBUG, true)
	r.config.Set(configuration.IN_MEMORY_THRESHOLD_BYTES, -1)
	r.config.Set(configuration.FLAG_SEVERITY_THRESHOLD, "high")
	r.config.Set(configuration.FF_TRANSFORMATION_WORKFLOW, true)

	r.engine = workflow.NewWorkFlowEngine(r.config)

	testCmnd := "subcmd1"
	workflowId1 := workflow.NewWorkflowIdentifier("output")

	outputFn := func(invocation workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
		var findings local_models.LocalFinding
		for i := range input {
			mimeType := input[i].GetContentType()

			if strings.HasPrefix(mimeType, content_type.LOCAL_FINDING_MODEL) {
				findingsBytes := input[i].GetPayload().([]byte)
				err := json.Unmarshal(findingsBytes, &findings)
				assert.NoError(t, err)
			}
		}

		// expect all findings below high to be filtered out
		assert.Equal(t, 1, len(findings.Findings))

		return input, nil
	}

	workflowConfig := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("pla", pflag.ContinueOnError))

	_, err := r.engine.Register(workflowId1, workflowConfig, outputFn)
	assert.NoError(t, err)

	// Register our data filter workflow
	err = localworkflows.InitFilterFindingsWorkflow(r.engine)
	assert.NoError(t, err)

	// Invoke a custom command that returns input
	fn := func(invocation workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
		typeId := workflow.NewTypeIdentifier(invocation.GetWorkflowIdentifier(), "workflowData")
		testSummary := json_schemas.TestSummary{
			Results: []json_schemas.TestSummaryResult{
				{
					Severity: "critical",
					Total:    10,
					Open:     10,
					Ignored:  0,
				},
			},
			Type:             "sast",
			SeverityOrderAsc: []string{"low", "medium", "high", "critical"},
		}

		var d []byte
		d, err = json.Marshal(testSummary)
		assert.NoError(t, err)

		testSummaryData := workflow.NewData(typeId, content_type.TEST_SUMMARY, d)
		sarifBytes := loadJsonFile(t, "sarif.json")

		localFindings, errTransform := localworkflows.TransformSarifToLocalFindingModel(sarifBytes, d)
		assert.NoError(t, errTransform)
		localFindingsBytes, errMarsh := json.Marshal(localFindings)
		assert.NoError(t, errMarsh)

		findingsData := workflow.NewData(typeId, content_type.LOCAL_FINDING_MODEL, localFindingsBytes)

		return []workflow.Data{
			testSummaryData,
			findingsData,
		}, nil
	}
	wrkflowId := workflow.NewWorkflowIdentifier(testCmnd)
	entry, err := r.engine.Register(wrkflowId, workflowConfig, fn)
	assert.NoError(t, err)
	assert.NotNil(t, entry)

	err = r.engine.Init()
	assert.NoError(t, err)

	logger := zerolog.New(os.Stderr)
	err = runWorkflowAndProcessData(t.Context(), r.engine, &logger, testCmnd)
}

func Test_setTimeout(t *testing.T) {
	r := newTestRun()
	exitedCh := make(chan struct{})
	fakeExit := func() {
		close(exitedCh)
	}
	r.config = configuration.NewWithOpts(configuration.WithAutomaticEnv())
	r.config.Set(configuration.TIMEOUT, 1)
	r.setTimeout(fakeExit)
	select {
	case <-exitedCh:
		break
	case <-time.After(5 * time.Second):
		t.Fatal("timeout func never executed")
	}
}

func Test_displayError(t *testing.T) {
	r := newTestRun()
	r.config = configuration.NewWithOpts(configuration.WithAutomaticEnv())
	mockController := gomock.NewController(t)
	userInterface := mocks.NewMockUserInterface(mockController)

	t.Run("prints out generic error messages", func(t *testing.T) {
		err := errors.New("test error")
		userInterface.EXPECT().OutputError(err, gomock.Any()).Times(1)

		r.displayError(t.Context(), err, userInterface, false)
	})

	scenarios := []struct {
		name string
		err  error
	}{
		{
			name: "exec.ExitError",
			err:  &exec.ExitError{},
		},
		{
			name: "clierrors.ErrorWithExitCode",
			err:  &clierrors.ErrorWithExitCode{ExitCode: 42},
		},
	}

	for _, scenario := range scenarios {
		t.Run(fmt.Sprintf("%s does not display anything", scenario.name), func(t *testing.T) {
			err := scenario.err
			r.displayError(t.Context(), err, userInterface, false)
		})
	}

	t.Run("prints messages of error wrapping exec.ExitError", func(t *testing.T) {
		err := &wrErr{wraps: &exec.ExitError{}}
		userInterface.EXPECT().OutputError(err, gomock.Any()).Times(1)

		r.displayError(t.Context(), err, userInterface, false)
	})
}

func Test_displayError_jsonOutputUsesInputDirectoryOfTheRun(t *testing.T) {
	r := newTestRun()
	r.config = configuration.NewWithOpts()
	r.config.Set(output_workflow.OUTPUT_CONFIG_KEY_JSON, true)
	r.config.Set(configuration.INPUT_DIRECTORY, "/some/dir")

	userInterface := mocks.NewMockUserInterface(gomock.NewController(t))
	userInterface.EXPECT().Output(gomock.Any()).DoAndReturn(func(out string) error {
		assert.Contains(t, out, `"path": "/some/dir"`)
		assert.Contains(t, out, "test error")
		return nil
	})

	r.displayError(t.Context(), errors.New("test error"), userInterface, false)
}

func Test_doctorTip(t *testing.T) {
	t.Run("CI advertises the --input flag", func(t *testing.T) {
		tip := doctorTip(true)
		assert.Contains(t, tip, "--input")
		assert.NotContains(t, tip, "2>&1")
	})

	t.Run("interactive advertises piping debug logs", func(t *testing.T) {
		tip := doctorTip(false)
		assert.Contains(t, tip, "2>&1 | snyk doctor --stdin")
		assert.NotContains(t, tip, "--input")
	})
}

type wrErr struct{ wraps error }

func (e *wrErr) Error() string { return "something went wrong" }
func (e *wrErr) Unwrap() error { return e.wraps }

func Test_processError(t *testing.T) {
	t.Run("nil error returns nil", func(t *testing.T) {
		errorList, err := processError(nil, nil)
		assert.Nil(t, err)
		assert.Empty(t, errorList)
	})

	t.Run("ExitError with exit code 1 preserves exit code", func(t *testing.T) {
		// Create a real exec.ExitError by running a command that fails
		cmd := exec.Command("sh", "-c", "exit 1")
		exitErr := cmd.Run()
		require.Error(t, exitErr)

		errorList, err := processError(exitErr, nil)
		assert.NotNil(t, err)
		assert.Len(t, errorList, 1)

		// The exit code should be preserved through DeriveExitCode
		exitCode := cliv2.DeriveExitCode(err)
		assert.Equal(t, 1, exitCode)
	})

	t.Run("ExitError with TS_CLI_TERMINATED is filtered out", func(t *testing.T) {
		// Create a real exec.ExitError with the terminate code
		cmd := exec.Command("sh", "-c", fmt.Sprintf("exit %d", constants.SNYK_EXIT_CODE_TS_CLI_TERMINATED))
		exitErr := cmd.Run()
		require.Error(t, exitErr)

		errorList, err := processError(exitErr, nil)
		assert.Nil(t, err)
		assert.Empty(t, errorList)
	})

	t.Run("ErrorWithExitCode is preserved", func(t *testing.T) {
		inputErr := &clierrors.ErrorWithExitCode{ExitCode: 1}
		errorList, err := processError(inputErr, nil)

		assert.NotNil(t, err)
		assert.Len(t, errorList, 1)

		var resultExitCode *clierrors.ErrorWithExitCode
		assert.True(t, errors.As(err, &resultExitCode))
		assert.Equal(t, 1, resultExitCode.ExitCode)

		exitCode := cliv2.DeriveExitCode(err)
		assert.Equal(t, 1, exitCode)
	})

	t.Run("multiple errors are joined and exit code is preserved", func(t *testing.T) {
		// Create a real exec.ExitError
		cmd := exec.Command("sh", "-c", "exit 1")
		exitErr := cmd.Run()
		require.Error(t, exitErr)

		otherErr := fmt.Errorf("some other error")
		errorList := []error{otherErr}

		resultList, err := processError(exitErr, errorList)
		assert.NotNil(t, err)
		assert.Len(t, resultList, 2)

		// The exit code should still be derivable
		exitCode := cliv2.DeriveExitCode(err)
		assert.Equal(t, 1, exitCode)
	})

	t.Run("snyk_errors.Error without special mapping gets exit code 2", func(t *testing.T) {
		// A snyk_errors.Error that's not in the exit code mapping
		snykErr := snyk_errors.Error{
			Title:     "Some Error",
			ErrorCode: "SNYK-9999",
			Level:     "error",
		}

		errorList, err := processError(snykErr, nil)
		assert.NotNil(t, err)
		assert.Len(t, errorList, 1)

		// This should result in exit code 2 since it's not mapped
		exitCode := cliv2.DeriveExitCode(err)
		assert.Equal(t, constants.SNYK_EXIT_CODE_ERROR, exitCode)
	})

	t.Run("maintenance error gets mapped to EX_TEMPFAIL", func(t *testing.T) {
		maintenanceErr := snyk_errors.Error{
			Title:     "Maintenance",
			ErrorCode: "SNYK-0099",
			Level:     "error",
		}

		errorList, err := processError(maintenanceErr, nil)
		assert.NotNil(t, err)
		assert.Len(t, errorList, 1)

		// Should be mapped to EX_TEMPFAIL (75)
		exitCode := cliv2.DeriveExitCode(err)
		assert.Equal(t, constants.SNYK_EXIT_CODE_EX_TEMPFAIL, exitCode)
	})

	t.Run("maintenance error in error list takes priority", func(t *testing.T) {
		// Create a real exec.ExitError with exit code 1
		cmd := exec.Command("sh", "-c", "exit 1")
		exitErr := cmd.Run()
		require.Error(t, exitErr)

		maintenanceErr := snyk_errors.Error{
			Title:     "Maintenance",
			ErrorCode: "SNYK-0099",
			Level:     "error",
		}

		// Pass exitErr as the main error, maintenance error in the list
		errorList := []error{maintenanceErr}
		resultList, err := processError(exitErr, errorList)

		assert.NotNil(t, err)
		assert.Len(t, resultList, 2)

		// Maintenance error should take priority, resulting in EX_TEMPFAIL
		exitCode := cliv2.DeriveExitCode(err)
		assert.Equal(t, constants.SNYK_EXIT_CODE_EX_TEMPFAIL, exitCode)
	})
}

// Test_tearDown_exitCode1WithNetworkErrors exercises the real tearDown function
// end-to-end, verifying that auxiliary network errors collected during a
// successful legacycli execution (exit code 1 = vulns found) do not leak to the
// user's terminal.
//
// The bug: processError joins the exit error with collected network errors via
// FindMostRelevantError/errors.Join. The joined error no longer satisfies the
// direct type assertion (*exec.ExitError) in displayError, so displayError
// prints the auxiliary network error after valid command output — breaking JSON
// output and showing misleading errors.
func Test_tearDown_exitCode1WithNetworkErrors(t *testing.T) {
	setupTearDownRun := func(t *testing.T, ctrl *gomock.Controller) (*cliRun, *mocks.MockUserInterface, analytics.Analytics) {
		t.Helper()

		r := newTestRun()

		r.config = configuration.NewWithOpts()
		r.config.Set(configuration.ANALYTICS_DISABLED, true)
		r.engine = workflow.NewWorkFlowEngine(r.config)

		err := basic_workflows.Init(r.engine)
		assert.NoError(t, err)
		err = r.engine.Init()
		assert.NoError(t, err)

		mockUI := mocks.NewMockUserInterface(ctrl)
		r.engine.SetUserInterface(mockUI)

		noopLog := zerolog.New(io.Discard)
		r.logger = &noopLog

		cliAnalytics := r.engine.GetAnalytics()
		return r, mockUI, cliAnalytics
	}

	t.Run("legacycli exit code 1 with collected network error", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		r, mockUI, cliAnalytics := setupTearDownRun(t, ctrl)

		commandErr := exec.Command("sh", "-c", "exit 1").Run()
		require.Error(t, commandErr)

		auxiliaryNetworkError := fmt.Errorf("transient network error during provenance fetch")
		errorList := []error{auxiliaryNetworkError}

		// OutputError must NOT be called — the command succeeded (vulns found).
		mockUI.EXPECT().OutputError(gomock.Any(), gomock.Any()).MaxTimes(0)
		mockUI.EXPECT().Output(gomock.Any()).MaxTimes(0)

		exitCode := r.tearDown(t.Context(), commandErr, errorList, time.Now(), networking.UserAgentInfo{}, cliAnalytics)
		assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, exitCode)
	})

	t.Run("ErrorWithExitCode 1 with collected network error", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		r, mockUI, cliAnalytics := setupTearDownRun(t, ctrl)

		commandErr := &clierrors.ErrorWithExitCode{
			ExitCode: constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND,
		}
		auxiliaryNetworkError := fmt.Errorf("transient network error during provenance fetch")
		errorList := []error{auxiliaryNetworkError}

		mockUI.EXPECT().OutputError(gomock.Any(), gomock.Any()).MaxTimes(0)
		mockUI.EXPECT().Output(gomock.Any()).MaxTimes(0)

		exitCode := r.tearDown(t.Context(), commandErr, errorList, time.Now(), networking.UserAgentInfo{}, cliAnalytics)
		assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, exitCode)
	})

	t.Run("exit code 2 with network errors still displays the error", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		r, mockUI, cliAnalytics := setupTearDownRun(t, ctrl)

		commandErr := exec.Command("sh", "-c", "exit 2").Run()
		require.Error(t, commandErr)

		auxiliaryNetworkError := fmt.Errorf("network error")
		errorList := []error{auxiliaryNetworkError}

		// displayError SHOULD show this error — the command genuinely failed.
		mockUI.EXPECT().OutputError(gomock.Any(), gomock.Any()).MinTimes(1)

		exitCode := r.tearDown(t.Context(), commandErr, errorList, time.Now(), networking.UserAgentInfo{}, cliAnalytics)
		assert.Equal(t, constants.SNYK_EXIT_CODE_ERROR, exitCode)
	})

	t.Run("arbitrary error with network errors still displays the error", func(t *testing.T) {
		ctrl := gomock.NewController(t)
		r, mockUI, cliAnalytics := setupTearDownRun(t, ctrl)

		commandErr := fmt.Errorf("this is a failure")
		auxiliaryNetworkError := fmt.Errorf("network error")
		errorList := []error{auxiliaryNetworkError}

		// displayError SHOULD show this error — the command genuinely failed.
		mockUI.EXPECT().OutputError(gomock.Any(), gomock.Any()).MinTimes(1)

		exitCode := r.tearDown(t.Context(), commandErr, errorList, time.Now(), networking.UserAgentInfo{}, cliAnalytics)
		assert.Equal(t, constants.SNYK_EXIT_CODE_ERROR, exitCode)
	})
}

func loadJsonFile(t *testing.T, filename string) []byte {
	t.Helper()

	jsonFile, err := os.Open("./testdata/" + filename)
	assert.NoError(t, err, "failed to load json")
	defer func(jsonFile *os.File) {
		jsonErr := jsonFile.Close()
		assert.NoError(t, jsonErr)
	}(jsonFile)
	byteValue, err := io.ReadAll(jsonFile)
	assert.NoError(t, err)
	return byteValue
}

func testHelpRouter() *helprouting.Router {
	helpDocs := helpdocs.FixtureCommandHelp()
	return &helprouting.Router{
		LegacyHelp: func() error { return nil },
		HasUserDoc: helpDocs.HasUserDoc,
	}
}

func Test_defaultNetworkRequestRetryAllowedPaths(t *testing.T) {
	tests := []struct {
		name          string
		existingValue interface{}
		expected      interface{}
	}{
		{"nil yields CLI defaults", nil, []string{"oauth2/token", "test-dep-graph", "verify/token", "feature_flags/evaluation"}},
		{"csv string splits and merges with defaults", "a,b", []string{"oauth2/token", "test-dep-graph", "verify/token", "feature_flags/evaluation", "a", "b"}},
		{"csv string trims whitespace and merges", "a, b", []string{"oauth2/token", "test-dep-graph", "verify/token", "feature_flags/evaluation", "a", "b"}},
		{"empty string yields just CLI defaults", "", []string{"oauth2/token", "test-dep-graph", "verify/token", "feature_flags/evaluation"}},
		{"non-empty slice merges with defaults", []string{"x"}, []string{"oauth2/token", "test-dep-graph", "verify/token", "feature_flags/evaluation", "x"}},
		{"empty slice yields CLI defaults", []string{}, []string{"oauth2/token", "test-dep-graph", "verify/token", "feature_flags/evaluation"}},
		{"interface slice from JSON merges with defaults", []interface{}{"y", "z"}, []string{"oauth2/token", "test-dep-graph", "verify/token", "feature_flags/evaluation", "y", "z"}},
	}

	config := configuration.NewWithOpts()
	defaultFunction := defaultNetworkRequestRetryAllowedPaths()

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			result, err := defaultFunction(config, tt.existingValue)

			assert.NoError(t, err)
			assert.Equal(t, tt.expected, result)
		})
	}
}

func Test_NetworkRequestRetryAllowedPaths_Integration(t *testing.T) {
	oldArgs := append([]string{}, os.Args...)
	os.Args = []string{"snyk", "--version"}
	defer func() { os.Args = oldArgs }()

	r, _ := execute(nil)

	paths := r.config.GetStringSlice(configuration.NETWORK_REQUEST_RETRY_ALLOWED_PATHS)
	assert.Contains(t, paths, "oauth2/token")
	assert.Contains(t, paths, "test-dep-graph")
	assert.Contains(t, paths, "verify/token")
	assert.Contains(t, paths, "feature_flags/evaluation")
}
