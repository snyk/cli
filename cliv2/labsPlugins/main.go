package main

import (
	"encoding/json"
	"strings"

	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/spf13/pflag"
)

const (
	pluginPath       = "plugin-path"
	pluginArgument	= "plugin-args"
	pluginWorkflowName = "plugin-workflow"
)


type MyObject struct {
	TestField string `json:"test"`
	TestBoolField bool `json:"bool"`
	DepGraphPayload `json:"data"`
}
type DepGraphPayload map[string]any


var WORKFLOWID_PLUGIN workflow.Identifier = workflow.NewWorkflowIdentifier(pluginWorkflowName)
var depGraphWorkflowID workflow.Identifier = workflow.NewWorkflowIdentifier("depgraph")
func PluginWorkflowEntryPoint(invocationCtx workflow.InvocationContext, data []workflow.Data) (output []workflow.Data, err error) {
	config := invocationCtx.GetConfiguration()
	logger := invocationCtx.GetEnhancedLogger()
	engine := invocationCtx.GetEngine()
	// fmt.Printf("In plugin workflow entry point with context %s", config.GetString(pluginPath))
	// fmt.Println("")
	// fmt.Println("plugin args:", config.GetString(pluginArgument))
	pluginConfig := pflag.NewFlagSet(pluginWorkflowName, pflag.ExitOnError)
	pluginConfig.Bool("args", false, "testing a bool")
	pluginConfig.String("test", "whatever", "testing a string arg")
	
	pluginConfig.Parse(strings.Split(config.GetString(pluginArgument), " "))
	value, err := pluginConfig.GetString("test")
	if err != nil {
		logger.Err(err)
	}
	
	depgraphData, depGraphError := engine.InvokeWithConfig(depGraphWorkflowID, config)
	if depGraphError != nil {
		logger.Err(depGraphError).Msg("depgraph workflow failed.")
	}
	
	depGraphOutput, _ := depgraphData[0].GetPayload().([]byte)
	
	
	jsonObject := MyObject{TestField: value}
	boolValue,err := pluginConfig.GetBool("args")
	if err != nil {
		logger.Err(err)
	}
	jsonObject.TestBoolField = boolValue

	var test DepGraphPayload
	errors := json.Unmarshal(depGraphOutput, &test)
	if errors != nil {
		logger.Err(err).Msg("Error unmarshaling JSON")
	}
	

	jsonObject.DepGraphPayload = test
	if err != nil {
		logger.Err(err)
	}
	
	jsonData, err := json.Marshal(jsonObject)
	if err != nil {
		logger.Err(err)
	}
	

	pluginData := createWorkflowData(jsonData, "application/json", logger, config)
	
	return []workflow.Data{pluginData}, nil
}

func createWorkflowData(data interface{}, contentType string, logger *zerolog.Logger, config configuration.Configuration) workflow.Data {
	return workflow.NewData(
		// use new type identifier when creating new data
		workflow.NewTypeIdentifier(WORKFLOWID_PLUGIN, pluginWorkflowName),
		contentType,
		data,
		workflow.WithLogger(logger),
		workflow.WithConfiguration(config),
	)
}