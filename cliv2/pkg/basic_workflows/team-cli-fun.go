package basic_workflows

import (
	"github.com/snyk/go-application-framework/pkg/local_workflows/output_workflow"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/spf13/pflag"
)

var WORKFLOWID_TEAM_CLI_FUN = workflow.NewWorkflowIdentifier("fun")

func initFun(engine workflow.Engine) error {
	entry, err := engine.Register(WORKFLOWID_TEAM_CLI_FUN, workflow.ConfigurationOptionsFromFlagset(pflag.NewFlagSet("cleanup", pflag.ContinueOnError)), entryPointToFun)
	if err != nil {
		return err
	}
	entry.SetVisibility(false)

	return nil
}

func entryPointToFun(
	invocation workflow.InvocationContext,
	_ []workflow.Data,
) ([]workflow.Data, error) {
	engine := invocation.GetEngine()

	config := engine.GetConfiguration()
	config.Set(output_workflow.OUTPUT_CONFIG_TEMPLATE_FILE, "fun.tmpl")

	codeTest := workflow.NewWorkflowIdentifier("code.test")
	output, err := engine.Invoke(codeTest)

	extraData := workflow.NewData(workflow.NewTypeIdentifier(WORKFLOWID_TEAM_CLI_FUN, "FunStuff"), "application/text", "fun fun fun")
	output = append(output, extraData)



	return output, err

}
