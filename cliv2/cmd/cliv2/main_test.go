package main

import (
	"os"
	"testing"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/spf13/pflag"
	"github.com/stretchr/testify/assert"
)

func cleanup() {
	helpProvided = false
	config = nil
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

func Test_CreateCommandsForWorkflowWithSubcommands(t *testing.T) {
	defer cleanup()

	config = configuration.New()
	config.Set(configuration.DEBUG, true)
	engine = workflow.NewWorkFlowEngine(config)

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

	engine.Init()
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
