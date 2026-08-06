package basic_workflows

import (
	"github.com/spf13/pflag"

	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/workflow"

	"github.com/snyk/cli/cliv2/internal/exitcode"
)

var MAIN_WORKLFOW_ID = workflow.NewWorkflowIdentifier("main")

const MAIN_WORKFLOW_PARAMETER = "main_internal_workflow_name"

func InitMainWorkflow(engine workflow.Engine) error {
	entry, err := engine.Register(MAIN_WORKLFOW_ID, workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("main", pflag.ContinueOnError)), mainEntryPoint)
	if err != nil {
		return err
	}
	entry.SetVisibility(false)
	return nil
}

func mainEntryPoint(invocation workflow.InvocationContext, input []workflow.Data) ([]workflow.Data, error) {
	engine := invocation.GetEngine()
	logger := invocation.GetEnhancedLogger()
	config := invocation.GetConfiguration()

	name := config.GetString(MAIN_WORKFLOW_PARAMETER)
	if len(name) == 0 {
		return []workflow.Data{}, nil
	}

	output, err := engine.Invoke(workflow.NewWorkflowIdentifier(name))
	if err != nil {
		logger.Print("Failed to execute the command! ", err)
		return []workflow.Data{}, err
	}

	outputFiltered, err := engine.Invoke(localworkflows.WORKFLOWID_FILTER_FINDINGS, workflow.WithInput(output))
	if err != nil {
		logger.Err(err).Msg(err.Error())
		return []workflow.Data{}, err
	}

	_, err = engine.Invoke(localworkflows.WORKFLOWID_OUTPUT_WORKFLOW, workflow.WithInput(outputFiltered))
	if err == nil {
		err = exitcode.GetErrorFromWorkFlowData(engine, outputFiltered)
	}
	return []workflow.Data{}, err
}
