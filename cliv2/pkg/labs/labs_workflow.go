package labs

import (
	"plugin"

	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/spf13/pflag"
)

const (
	labsWorkflowName = "labs"
	jsonFlag         = "json"
	pluginPath       = "plugin-path"
	pluginArgs       = "plugin-args"
)

var WORKFLOWID_LABS workflow.Identifier = workflow.NewWorkflowIdentifier(labsWorkflowName)

func InitLabsWorkflow(engine workflow.Engine) error {
	// initialise workflow configuration
	labsConfig := pflag.NewFlagSet(labsWorkflowName, pflag.ExitOnError)
	labsConfig.String(pluginPath, "anypath", "Path to plugin file.")
	labsConfig.Bool(jsonFlag, false, "output in json format")
	labsConfig.String(pluginArgs, "", "Args for the plugin")
	// register workflow with engine
	_, err := engine.Register(WORKFLOWID_LABS, workflow.ConfigurationOptionsFromFlagset(labsConfig), labsWorkflowEntryPoint)

	return err
}

func labsWorkflowEntryPoint(invocationCtx workflow.InvocationContext, data []workflow.Data) (output []workflow.Data, err error) {
	config := invocationCtx.GetConfiguration()
	logger := invocationCtx.GetEnhancedLogger()

	pluginPath := config.GetString(pluginPath)

	// 1. Load the precompiled .so file
	p, err := plugin.Open(pluginPath)
	if err != nil {
		logger.Err(err).Msg("could not open plugin")
	}

	// 2. Look up a function ("symbol") in the plugin
	pluginWorkflowEntryPoint, err := p.Lookup("PluginWorkflowEntryPoint")
	if err != nil {
		logger.Err(err).Msg("symbol is not the correct function type")
	}
	// 3. Call the function from the plugin
	pluginOutput, err := pluginWorkflowEntryPoint.(func(workflow.InvocationContext, []workflow.Data) (output []workflow.Data, err error))(invocationCtx, data)
	if err != nil {
		logger.Err(err).Msg("Plugin workflow entry point failed")
	}

	return pluginOutput, err

}
