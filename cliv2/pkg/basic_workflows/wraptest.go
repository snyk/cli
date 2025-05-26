package basic_workflows

import (
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/spf13/pflag"
)

var WORKFLOWID_WRAPTEST workflow.Identifier = workflow.NewWorkflowIdentifier("wraptest")
var DATATYPEID_WRAPTEST_STDOUT workflow.Identifier = workflow.NewTypeIdentifier(WORKFLOWID_WRAPTEST, "stdout")

// initWraptest registers the wraptest workflow with the engine
func initWraptest(engine workflow.Engine) error {
	flagset := pflag.NewFlagSet("wraptest", pflag.ContinueOnError)

	// Add command-specific flags
	flagset.Bool("usestdio", false, "Use standard input/output streams")
	flagset.StringSlice("args", []string{}, "Arguments to pass to the command")

	config := workflow.ConfigurationOptionsFromFlagset(flagset)
	entry, err := engine.Register(WORKFLOWID_WRAPTEST, config, wraptestWorkflow)
	if err != nil {
		return err
	}

	// Set to true if you want this command to appear in help output
	entry.SetVisibility(true)

	return nil
}

// wraptestWorkflow is the main workflow function for the wraptest command
func wraptestWorkflow(
	invocation workflow.InvocationContext,
	_ []workflow.Data,
) (_ []workflow.Data, err error) {

	// Get configuration and logger
	config := invocation.GetConfiguration()
	logger := invocation.GetEnhancedLogger()

	// Check if stdio flag is set
	useStdio := config.GetBool("usestdio")
	logger.Printf("Using stdio: %v", useStdio)

	// Always use the legacy CLI workflow
	logger.Print("Forwarding to legacy CLI workflow")

	var args []string
	rawArgs := config.GetStringSlice(configuration.RAW_CMD_ARGS)
	// Filter out the 'wraptest' and '--usestdio' arguments
	for _, arg := range rawArgs {
		if arg != "wraptest" && arg != "--usestdio" {
			args = append(args, arg)
		}
	}

	logger.Printf("Forwarding arguments: %v", args)

	// Create a new configuration for the legacy CLI workflow
	legacyConfig := config.Clone()
	legacyConfig.Set(configuration.RAW_CMD_ARGS, args)

	// Set the WORKFLOW_USE_STDIO flag based on the usestdio flag
	legacyConfig.Set(configuration.WORKFLOW_USE_STDIO, useStdio)

	// Execute the legacy CLI workflow
	legacyData, legacyErr := invocation.GetEngine().InvokeWithConfig(WORKFLOWID_LEGACY_CLI, legacyConfig)
	return legacyData, legacyErr
}
