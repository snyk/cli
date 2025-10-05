package main

// !!! This import needs to be the first import, please do not change this !!!
import _ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"

import (
	"os/exec"
	"strings"
	"time"

	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/instrumentation"

	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/networking"
	"github.com/snyk/go-application-framework/pkg/networking/middleware"
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

func addRuntimeDetails(instrumentor analytics.InstrumentationCollector, ua networking.UserAgentInfo) {
	if !strings.EqualFold(ua.OS, "linux") {
		return
	}

	if out, err := exec.Command("uname", "-v").Output(); err == nil {
		instrumentor.AddExtension("os-details", strings.TrimSpace(string(out)))
	}

	if out, err := exec.Command("ldd", "--version").Output(); err == nil {
		instrumentor.AddExtension("c-runtime-details", strings.TrimSpace(string(out)))
	}
}

func addNetworkingDetails(instrumentor analytics.InstrumentationCollector, config configuration.Configuration) {
	instrumentor.AddExtension("network-request-attempts", config.GetInt(middleware.ConfigurationKeyRetryAttempts))
}

func updateInstrumentationDataBeforeSending(cliAnalytics analytics.Analytics, startTime time.Time, ua networking.UserAgentInfo, exitCode int) {
	targetId, targetIdError := instrumentation.GetTargetId(globalConfiguration.GetString(configuration.INPUT_DIRECTORY), instrumentation.AutoDetectedTargetId, instrumentation.WithConfiguredRepository(globalConfiguration))
	if targetIdError != nil {
		globalLogger.Printf("Failed to derive target id, %v", targetIdError)
	}
	cliAnalytics.GetInstrumentation().SetTargetId(targetId)

	if cliAnalytics.GetInstrumentation().GetDuration() == 0 {
		cliAnalytics.GetInstrumentation().SetDuration(time.Since(startTime))
	}

	addRuntimeDetails(cliAnalytics.GetInstrumentation(), ua)
	addNetworkingDetails(cliAnalytics.GetInstrumentation(), globalConfiguration)

	cliAnalytics.GetInstrumentation().AddExtension("exitcode", exitCode)
	if exitCode == 2 {
		cliAnalytics.GetInstrumentation().SetStatus(analytics.Failure)
	}
}
