package main

// !!! This import needs to be the first import, please do not change this !!!
import _ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"

import (
	"strings"

	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/configuration"
	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/utils"
	"github.com/snyk/go-application-framework/pkg/workflow"
)

func shallSendInstrumentation(config configuration.Configuration, instrumentor analytics.InstrumentationCollector) bool {
	instrumentationCommand := workflow.GetCommandFromWorkflowIdentifier(localworkflows.WORKFLOWID_REPORT_ANALYTICS)
	category := strings.Join(instrumentor.GetCategory(), " ")
	integration := config.GetString(configuration.INTEGRATION_NAME)

	isSnykIde := utils.IsSnykIde(integration)
	isReportCommand := strings.Contains(category, instrumentationCommand)

	if isSnykIde || isReportCommand {
		return false
	}

	return true
}
