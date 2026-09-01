package core

import (
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"testing"
	"time"

	"github.com/golang/mock/gomock"
	"github.com/rs/zerolog"
	"github.com/snyk/cli/cliv2/internal/helpdocs"
	"github.com/snyk/cli/cliv2/internal/helprouting"
	"github.com/snyk/error-catalog-golang-public/code"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/snyk/go-application-framework/pkg/apiclients/testapi"
	"github.com/snyk/go-application-framework/pkg/configuration"
	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/local_workflows/content_type"
	"github.com/snyk/go-application-framework/pkg/local_workflows/json_schemas"
	"github.com/snyk/go-application-framework/pkg/local_workflows/local_models"
	"github.com/snyk/go-application-framework/pkg/logging"
	"github.com/snyk/go-application-framework/pkg/mocks"
	"github.com/snyk/go-application-framework/pkg/utils/ufm"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	clierrors "github.com/snyk/cli/cliv2/internal/errors"
)

func cleanup() {
	helpProvided = false
	globalConfiguration = nil
	globalEngine = nil
}

func Test_mainWithErrorCode(t *testing.T) {
	defer cleanup()
	oldArgs := append([]string{}, os.Args...)
	os.Args = []string{"snyk", "--version"}
	defer func() { os.Args = oldArgs }()

	errCode := mainWithErrorCode(nil)
	assert.False(t, globalConfiguration.GetBool(configuration.CONFIG_CACHE_DISABLED))
	assert.Equal(t, configuration.NoCacheExpiration, globalConfiguration.GetDuration(configuration.CONFIG_CACHE_TTL))

	assert.Equal(t, 0, errCode)

	t.Run("outputs an error list", func(t *testing.T) {
		t.Setenv("SNYK_TOKEN", "invalidToken")
		defer cleanup()
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

// redactionTermsFor runs populateRedactionTerms with args standing in for the command
// line, against an engine holding one registered workflow that declares declaredFlags.
// That is the only route by which a flag counts as declared, so it is what separates
// "the CLI accepts this flag" from "nobody has ever heard of this flag" in the sweep.
func redactionTermsFor(t *testing.T, args []string, declaredFlags []string) []string {
	t.Helper()

	config, engine := redactionSweepInput(t, args, declaredFlags)
	return populateRedactionTerms(config, engine)
}

// debugRedactionTermsFor is redactionTermsFor against the other sweep, the one whose
// terms reach the debug log scrubber.
func debugRedactionTermsFor(t *testing.T, args []string, declaredFlags []string) []string {
	t.Helper()

	config, engine := redactionSweepInput(t, args, declaredFlags)
	knownTerms, _ := knownRedactionTerms(config, engine)
	return debugRedactionTerms(knownTerms)
}

func redactionSweepInput(t *testing.T, args []string, declaredFlags []string) (configuration.Configuration, workflow.Engine) {
	t.Helper()

	flagset := pflag.NewFlagSet("test", pflag.ContinueOnError)
	for _, flagName := range declaredFlags {
		flagset.String(flagName, "", "")
	}

	mockController := gomock.NewController(t)
	workflowEntry := mocks.NewMockEntry(mockController)
	workflowEntry.EXPECT().GetConfigurationOptions().Return(workflow.ConfigurationOptionsFromFlagset(flagset))
	workflowId := workflow.NewWorkflowIdentifier("agent")
	mockEngine := mocks.NewMockEngine(mockController)
	mockEngine.EXPECT().GetWorkflows().Return([]workflow.Identifier{workflowId})
	mockEngine.EXPECT().GetWorkflow(workflowId).Return(workflowEntry, true)

	oldArgs := os.Args
	os.Args = append([]string{"snyk"}, args...)
	t.Cleanup(func() { os.Args = oldArgs })

	return configuration.NewWithOpts(configuration.WithAutomaticEnv()), mockEngine
}

// CLI-1819: the sweep used to treat every argv token it could not name as a secret, so
// it redacted the CLI's own analytics values out of its own events. A token is now a
// candidate only when the token before it is a flag no workflow declared.
func Test_populateRedactionTerms_sweepsOnlyValuesOfUndeclaredFlags(t *testing.T) {
	t.Run("a positional operand contributes no terms", func(t *testing.T) {
		assessment := "the scan missed a hardcoded credential in the deploy script"

		terms := redactionTermsFor(t, []string{"agent", "feedback", assessment}, nil)

		for _, word := range strings.Fields(assessment) {
			assert.NotContains(t, terms, word, "a positional operand is a value the CLI accepts, not a secret to guess at")
		}
	})

	t.Run("a declared flag's value contributes no term", func(t *testing.T) {
		terms := redactionTermsFor(t, []string{"agent", "feedback", "--use-case", "code-review-automation"}, []string{"use-case"})

		assert.NotContains(t, terms, "code-review-automation", "a workflow declared --use-case, so its value is not a guessed-at secret")
	})

	t.Run("an undeclared flag's value still contributes a term", func(t *testing.T) {
		terms := redactionTermsFor(t, []string{"agent", "--not-a-declared-flag", "unmistakably-secret-value"}, []string{"use-case"})

		assert.Contains(t, terms, "unmistakably-secret-value", "nothing declared this flag, so its value is still assumed to be a secret")
	})

	t.Run("an environment variable value still contributes a term", func(t *testing.T) {
		// Environment entries are rendered into the token stream as a flag token nothing
		// can declare, so they stay candidates without the sweep carrying a special case
		// for them.
		t.Setenv("SNYK_TEST_REDACTION_MARKER", "unmistakably-secret-value")

		terms := redactionTermsFor(t, []string{"agent"}, []string{"use-case"})

		assert.Contains(t, terms, "unmistakably-secret-value", "environment variable values must keep being redacted")
	})

	t.Run("an environment variable named after a declared flag still contributes a term", func(t *testing.T) {
		// The declared-flag check is case sensitive and "org" is a real declared flag,
		// so a variable of that name must not be able to borrow the flag's trust.
		t.Setenv("org", "unmistakably-secret-value")

		terms := redactionTermsFor(t, []string{"agent"}, []string{"use-case"})

		assert.Contains(t, terms, "unmistakably-secret-value", "an environment variable name is not a declared flag, whatever it is called")
	})

	t.Run("every word of a multi-word undeclared flag value contributes a term", func(t *testing.T) {
		terms := redactionTermsFor(t, []string{"agent", "--custom-header", "Bearer unmistakably-secret-value"}, []string{"use-case"})

		assert.Contains(t, terms, "unmistakably-secret-value", "sweeping only the first word of a secret leaves the rest of it in the clear")
	})

	t.Run("every word of a multi-word environment value contributes a term", func(t *testing.T) {
		t.Setenv("SNYK_TEST_REDACTION_MARKER", "Bearer unmistakably-secret-value")

		terms := redactionTermsFor(t, []string{"agent"}, []string{"use-case"})

		assert.Contains(t, terms, "unmistakably-secret-value", "sweeping only the first word of a secret leaves the rest of it in the clear")
	})

	t.Run("a declared flag with a sensitive name still contributes a term", func(t *testing.T) {
		// Trusting declared flags is only safe while no declared flag carries a secret,
		// and some do (--tfc-token ships today). A declared flag whose name matches the
		// scrubber's own sensitive field names keeps being swept.
		terms := redactionTermsFor(t, []string{"agent", "--auth-token", "unmistakably-secret-value"}, []string{"auth-token"})

		assert.Contains(t, terms, "unmistakably-secret-value", "a declared flag whose name looks sensitive must keep being swept")
	})
}

// CLI-1819, the accepted cost of trusting declared flags, recorded here deliberately.
// Exempting a declared flag's value is what buys back the analytics data the old sweep
// destroyed, and it is not free. --client-id and --tenant-id are declared flags (the
// first by GAF's auth workflow, the second by the agent-scan workflow's flagset) and
// neither name contains any of logging.SENSITIVE_FIELD_NAMES, so their values now reach
// analytics in the clear where the old sweep would have redacted them. That is the price
// of the trade rather than an oversight: a registered workflow put its name to those
// flags, so the CLI knows what they carry and chooses to keep it.
//
// The safety net is the only thing standing between that trade and a declared flag being
// a way to smuggle a credential into analytics, which is why it gets its own case below.
// --client-secret is declared exactly as --client-id is, and the single reason its value
// stays out of analytics is the word "secret" in its name. A flag carrying something that
// must not be logged has to be named so the net catches it.
func Test_populateRedactionTerms_theCostOfTrustingDeclaredFlags(t *testing.T) {
	declaredFlags := []string{"client-id", "tenant-id", "client-secret"}

	for _, flag := range []string{"client-id", "tenant-id"} {
		t.Run("--"+flag+", a declared flag with a non-sensitive name, contributes no term", func(t *testing.T) {
			terms := redactionTermsFor(t, []string{"auth", "--" + flag, "unmistakably-secret-value"}, declaredFlags)

			assert.NotContains(t, terms, "unmistakably-secret-value", "the value of a declared flag whose name looks harmless now reaches analytics unredacted, and that is the accepted cost of trusting declared flags")
		})
	}

	t.Run("--client-secret, a declared flag whose name contains a sensitive substring, still contributes a term", func(t *testing.T) {
		terms := redactionTermsFor(t, []string{"auth", "--client-secret", "unmistakably-secret-value"}, declaredFlags)

		assert.Contains(t, terms, "unmistakably-secret-value", "the safety net is the only reason a declared flag cannot be used to smuggle a credential into analytics")
	})
}

// CLI-1819: only analytics narrowed. A debug log is read by the person who pastes it
// into a support ticket, so it keeps redacting everything it cannot name, including the
// values analytics deliberately stopped treating as secrets.
func Test_debugRedactionTerms_keepsTheAggressiveSweep(t *testing.T) {
	t.Run("a positional operand", func(t *testing.T) {
		args := []string{"agent", "feedback", "could-be-a-secret-pasted-as-an-operand"}

		assert.NotContains(t, redactionTermsFor(t, args, nil), "could-be-a-secret-pasted-as-an-operand")
		assert.Contains(t, debugRedactionTermsFor(t, args, nil), "could-be-a-secret-pasted-as-an-operand", "the debug log must keep scrubbing what the analytics sweep now lets through")
	})

	t.Run("a declared flag's value", func(t *testing.T) {
		args := []string{"agent", "feedback", "--use-case", "could-be-a-secret-behind-a-known-flag"}

		assert.NotContains(t, redactionTermsFor(t, args, []string{"use-case"}), "could-be-a-secret-behind-a-known-flag")
		assert.Contains(t, debugRedactionTermsFor(t, args, []string{"use-case"}), "could-be-a-secret-behind-a-known-flag", "the debug log must keep scrubbing what the analytics sweep now lets through")
	})
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
	defer cleanup()

	globalConfiguration = configuration.New()
	globalConfiguration.Set(configuration.DEBUG, true)
	globalEngine = workflow.NewWorkFlowEngine(globalConfiguration)

	fn := func(invocation workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
		return []workflow.Data{}, nil
	}

	// setup workflow engine to contain a workflow with subcommands
	commandList := []string{"output", "cmd2 something", "cmd subcmd1 subcmd2", "cmd subcmd1 subcmd3", "cmd"}
	for _, v := range commandList {
		workflowConfig := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("pla", pflag.ContinueOnError))
		workflowId1 := workflow.NewWorkflowIdentifier(v)
		_, err := globalEngine.Register(workflowId1, workflowConfig, fn)
		assert.NoError(t, err)
	}

	_ = globalEngine.Init()
	rootCommand := prepareRootCommand(testHelpRouter())

	// invoke method under test
	createCommandsForWorkflows(rootCommand, globalEngine)

	// test that root subcmd2 has expected subcommands
	cmd, _, _ := rootCommand.Find([]string{"cmd"})
	subcmd1, _, _ := rootCommand.Find([]string{"cmd", "subcmd1"})
	subcmd2, _, _ := rootCommand.Find([]string{"cmd", "subcmd1", "subcmd2"})
	subcmd3, _, _ := rootCommand.Find([]string{"cmd", "subcmd1", "subcmd3"})
	cmd2, _, _ := rootCommand.Find([]string{"cmd2"})
	something, _, _ := rootCommand.Find([]string{"cmd2", "something"})
	parseError := cmd.ParseFlags([]string{"cmd", "--unknown"})

	// test which command triggers a handleError() and which not
	assert.Equal(t, handleErrorUnhandled, handleError(cmd.RunE(cmd, []string{})))
	assert.Equal(t, handleErrorUnhandled, handleError(subcmd2.RunE(subcmd2, []string{})))
	assert.Equal(t, handleErrorUnhandled, handleError(subcmd3.RunE(subcmd3, []string{})))
	assert.Equal(t, handleErrorUnhandled, handleError(something.RunE(something, []string{})))
	assert.Equal(t, handleErrorFallbackToLegacyCLI, handleError(subcmd1.RunE(subcmd1, []string{})))
	assert.Equal(t, handleErrorFallbackToLegacyCLI, handleError(cmd2.RunE(cmd2, []string{})))
	assert.Equal(t, handleErrorShowHelp, handleError(parseError))

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

// setupMainWorkflowTestEnv wires up the global engine/config that runMainWorkflow needs and
// returns a fresh per-invocation config plus a command. Callers should `defer cleanup()`.
func setupMainWorkflowTestEnv(t *testing.T) (configuration.Configuration, *cobra.Command) {
	t.Helper()

	globalConfiguration = configuration.New()
	globalConfiguration.Set(configuration.DEBUG, true)
	globalEngine = workflow.NewWorkFlowEngine(globalConfiguration)

	noopWorkflow := func(workflow.InvocationContext, []workflow.Data) ([]workflow.Data, error) {
		return []workflow.Data{}, nil
	}
	for _, name := range []string{"command", localworkflows.WORKFLOWID_OUTPUT_WORKFLOW.Host} {
		opts := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("pla", pflag.ContinueOnError))
		_, err := globalEngine.Register(workflow.NewWorkflowIdentifier(name), opts, noopWorkflow)
		require.NoError(t, err)
	}
	require.NoError(t, localworkflows.InitDataTransformationWorkflow(globalEngine))
	_ = globalEngine.Init()
	require.NoError(t, localworkflows.InitFilterFindingsWorkflow(globalEngine))

	return configuration.NewWithOpts(configuration.WithAutomaticEnv()), &cobra.Command{Use: "command"}
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
			defer cleanup()
			config, cmd := setupMainWorkflowTestEnv(t)

			require.NoError(t, runMainWorkflow(config, cmd, tc.positionalArgs, tc.rawArgs))

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
	defer cleanup()
	globalConfiguration = configuration.New()
	globalConfiguration.Set(configuration.DEBUG, true)
	globalEngine = workflow.NewWorkFlowEngine(globalConfiguration)

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

	_, err := globalEngine.Register(workflowId1, workflowConfig, outputFn)
	assert.NoError(t, err)
	// Register our data filter workflow
	err = localworkflows.InitFilterFindingsWorkflow(globalEngine)
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

	entry, err := globalEngine.Register(wrkflowId, workflowConfig, fn)
	assert.Nil(t, err)
	assert.NotNil(t, entry)

	// Register our data transformation workflow
	err = localworkflows.InitDataTransformationWorkflow(globalEngine)
	assert.NoError(t, err)

	err = globalEngine.Init()
	assert.NoError(t, err)

	// invoke method under test
	logger := zerolog.New(os.Stderr)
	err = runWorkflowAndProcessData(t.Context(), globalEngine, &logger, testCmnd)

	var expectedError *clierrors.ErrorWithExitCode
	assert.ErrorAs(t, err, &expectedError)
	assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, expectedError.ExitCode)

	actualCode := cliv2.DeriveExitCode(err)
	assert.Equal(t, constants.SNYK_EXIT_CODE_VULNERABILITIES_FOUND, actualCode)
}

func Test_runWorkflowAndProcessData_with_Filtering(t *testing.T) {
	defer cleanup()
	globalConfiguration = configuration.New()
	globalConfiguration.Set(configuration.DEBUG, true)
	globalConfiguration.Set(configuration.IN_MEMORY_THRESHOLD_BYTES, -1)
	globalConfiguration.Set(configuration.FLAG_SEVERITY_THRESHOLD, "high")
	globalConfiguration.Set(configuration.FF_TRANSFORMATION_WORKFLOW, true)

	globalEngine = workflow.NewWorkFlowEngine(globalConfiguration)

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

	_, err := globalEngine.Register(workflowId1, workflowConfig, outputFn)
	assert.NoError(t, err)

	// Register our data filter workflow
	err = localworkflows.InitFilterFindingsWorkflow(globalEngine)
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
	entry, err := globalEngine.Register(wrkflowId, workflowConfig, fn)
	assert.NoError(t, err)
	assert.NotNil(t, entry)

	err = globalEngine.Init()
	assert.NoError(t, err)

	logger := zerolog.New(os.Stderr)
	err = runWorkflowAndProcessData(t.Context(), globalEngine, &logger, testCmnd)
}

func Test_setTimeout(t *testing.T) {
	exitedCh := make(chan struct{})
	fakeExit := func() {
		close(exitedCh)
	}
	config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
	config.Set(configuration.TIMEOUT, 1)
	setTimeout(config, fakeExit)
	select {
	case <-exitedCh:
		break
	case <-time.After(5 * time.Second):
		t.Fatal("timeout func never executed")
	}
}

func Test_displayError(t *testing.T) {
	mockController := gomock.NewController(t)
	userInterface := mocks.NewMockUserInterface(mockController)

	t.Run("prints out generic error messages", func(t *testing.T) {
		err := errors.New("test error")
		userInterface.EXPECT().OutputError(err, gomock.Any()).Times(1)

		config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		displayError(err, userInterface, config, t.Context(), false)
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
			config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
			err := scenario.err
			displayError(err, userInterface, config, t.Context(), false)
		})
	}

	t.Run("prints messages of error wrapping exec.ExitError", func(t *testing.T) {
		err := &wrErr{wraps: &exec.ExitError{}}
		userInterface.EXPECT().OutputError(err, gomock.Any()).Times(1)

		config := configuration.NewWithOpts(configuration.WithAutomaticEnv())
		displayError(err, userInterface, config, t.Context(), false)
	})
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
	defer cleanup()
	oldArgs := append([]string{}, os.Args...)
	os.Args = []string{"snyk", "--version"}
	defer func() { os.Args = oldArgs }()

	_ = mainWithErrorCode(nil)

	paths := globalConfiguration.GetStringSlice(configuration.NETWORK_REQUEST_RETRY_ALLOWED_PATHS)
	assert.Contains(t, paths, "oauth2/token")
	assert.Contains(t, paths, "test-dep-graph")
	assert.Contains(t, paths, "verify/token")
	assert.Contains(t, paths, "feature_flags/evaluation")
}
