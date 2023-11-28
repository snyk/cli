package main

import (
	"os"
	"testing"
	"time"

	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"

	"github.com/snyk/go-application-framework/pkg/configuration"
	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

func cleanup() {
	helpProvided = false
	globalConfiguration = nil
	engine = nil
}

func Test_MainWithErrorCode(t *testing.T) {
	defer cleanup()
	oldArgs := append([]string{}, os.Args...)
	os.Args = []string{"snyk", "--version"}
	defer func() { os.Args = oldArgs }()

	err := MainWithErrorCode()

	assert.Equal(t, 0, err)
}

func Test_initApplicationConfiguration_DisablesAnalytics(t *testing.T) {
	t.Run("via SNYK_DISABLE_ANALYTICS (true)", func(t *testing.T) {
		c := configuration.NewInMemory()
		assert.False(t, c.GetBool(configuration.ANALYTICS_DISABLED))

		c.Set("SNYK_DISABLE_ANALYTICS", "true")
		initApplicationConfiguration(c)

		assert.True(t, c.GetBool(configuration.ANALYTICS_DISABLED))
	})
	t.Run("via SNYK_DISABLE_ANALYTICS (1)", func(t *testing.T) {
		c := configuration.NewInMemory()
		assert.False(t, c.GetBool(configuration.ANALYTICS_DISABLED))

		c.Set("SNYK_DISABLE_ANALYTICS", "1")
		initApplicationConfiguration(c)

		assert.True(t, c.GetBool(configuration.ANALYTICS_DISABLED))
	})
	t.Run("via SNYK_CFG_DISABLE_ANALYTICS (true)", func(t *testing.T) {
		c := configuration.NewInMemory()
		assert.False(t, c.GetBool(configuration.ANALYTICS_DISABLED))

		c.Set("SNYK_CFG_DISABLE_ANALYTICS", "true")
		initApplicationConfiguration(c)

		assert.True(t, c.GetBool(configuration.ANALYTICS_DISABLED))
	})
	t.Run("via SNYK_CFG_DISABLE_ANALYTICS (1)", func(t *testing.T) {
		c := configuration.NewInMemory()
		assert.False(t, c.GetBool(configuration.ANALYTICS_DISABLED))

		c.Set("SNYK_CFG_DISABLE_ANALYTICS", "1")
		initApplicationConfiguration(c)

		assert.True(t, c.GetBool(configuration.ANALYTICS_DISABLED))
	})
	t.Run("via DISABLE-ANALYTICS (true)", func(t *testing.T) {
		c := configuration.NewInMemory()
		assert.False(t, c.GetBool(configuration.ANALYTICS_DISABLED))

		c.Set("disable-analytics", "true")
		initApplicationConfiguration(c)

		assert.True(t, c.GetBool(configuration.ANALYTICS_DISABLED))
	})
	t.Run("via DISABLE-ANALYTICS (1)", func(t *testing.T) {
		c := configuration.NewInMemory()
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
	engine = workflow.NewWorkFlowEngine(globalConfiguration)

	fn := func(invocation workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
		return []workflow.Data{}, nil
	}

	// setup workflow engine to contain a workflow with subcommands
	commandList := []string{"output", "cmd2 something", "cmd subcmd1 subcmd2", "cmd subcmd1 subcmd3", "cmd"}
	for _, v := range commandList {
		workflowConfig := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("pla", pflag.ContinueOnError))
		workflowId1 := workflow.NewWorkflowIdentifier(v)
		_, err := engine.Register(workflowId1, workflowConfig, fn)
		if err != nil {
			t.Fatal(err)
		}
	}

	_ = engine.Init()
	rootCommand := prepareRootCommand()

	// invoke method under test
	createCommandsForWorkflows(rootCommand, engine)

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

func Test_runMainWorkflow_unknownargs(t *testing.T) {

	tests := map[string]struct {
		inputDir    string
		unknownArgs []string
	}{
		"input dir with unknown arguments":    {inputDir: "a/b/c", unknownArgs: []string{"a", "b", "c"}},
		"no input dir with unknown arguments": {inputDir: "", unknownArgs: []string{"a", "b", "c"}},
		"input dir without unknown arguments": {inputDir: "a", unknownArgs: []string{}},
	}

	for name, tc := range tests {
		t.Run(name, func(t *testing.T) {

			expectedInputDir := tc.inputDir
			expectedUnknownArgs := tc.unknownArgs

			defer cleanup()
			globalConfiguration = configuration.New()
			globalConfiguration.Set(configuration.DEBUG, true)
			engine = workflow.NewWorkFlowEngine(globalConfiguration)

			fn := func(invocation workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
				return []workflow.Data{}, nil
			}

			// setup workflow engine to contain a workflow with subcommands
			commandList := []string{"command", localworkflows.WORKFLOWID_OUTPUT_WORKFLOW.Host}
			for _, v := range commandList {
				workflowConfig := workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("pla", pflag.ContinueOnError))
				workflowId1 := workflow.NewWorkflowIdentifier(v)
				_, err := engine.Register(workflowId1, workflowConfig, fn)
				if err != nil {
					t.Fatal(err)
				}
			}

			_ = engine.Init()

			config := configuration.NewInMemory()
			cmd := &cobra.Command{
				Use: "command",
			}

			positionalArgs := []string{expectedInputDir}
			positionalArgs = append(positionalArgs, expectedUnknownArgs...)

			rawArgs := []string{"app", "command", "--sad", expectedInputDir}
			if len(expectedUnknownArgs) > 0 {
				rawArgs = append(rawArgs, "--")
				rawArgs = append(rawArgs, expectedUnknownArgs...)
			}

			// call method under test
			err := runMainWorkflow(config, cmd, positionalArgs, rawArgs)
			assert.Nil(t, err)

			actualInputDir := config.GetString(configuration.INPUT_DIRECTORY)
			assert.Equal(t, expectedInputDir, actualInputDir)

			actualUnknownArgs := config.GetStringSlice(configuration.UNKNOWN_ARGS)
			assert.Equal(t, expectedUnknownArgs, actualUnknownArgs)
		})
	}
}

func Test_setTimeout(t *testing.T) {
	exitedCh := make(chan struct{})
	fakeExit := func() {
		close(exitedCh)
	}
	config := configuration.New()
	config.Set(configuration.TIMEOUT, 1)
	setTimeout(config, fakeExit)
	select {
	case <-exitedCh:
		break
	case <-time.After(5 * time.Second):
		t.Fatal("timeout func never executed")
	}
}
