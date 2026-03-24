package main

// !!! This import needs to be the first import, please do not change this !!!
import _ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"

import (
	"context"
	"encoding/json"
	"os/exec"
	"strconv"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/instrumentation"

	"github.com/snyk/cli/cliv2/internal/constants"
	cli_utils "github.com/snyk/cli/cliv2/internal/utils"

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

	cRuntimeDetails := cli_utils.GetGlibcDetails(cli_utils.ParserGlibcFull())
	if cRuntimeDetails != "" {
		instrumentor.AddExtension("c-runtime-details", cRuntimeDetails)
	}
}

func addNetworkingDetails(instrumentor analytics.InstrumentationCollector, config configuration.Configuration) {
	instrumentor.AddExtension("network-request-attempts", config.GetInt(middleware.ConfigurationKeyRequestAttempts))
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

func sendAnalytics(ctx context.Context, a analytics.Analytics, debugLogger *zerolog.Logger) {
	debugLogger.Print("Sending Analytics")

	a.SetApiUrl(globalConfiguration.GetString(configuration.API_URL))

	request, err := a.GetRequest()
	if err != nil {
		debugLogger.Err(err).Msg("Failed to create Analytics request")
		return
	}

	// Use context to respect teardown timeout
	request = request.WithContext(ctx)

	client := globalEngine.GetNetworkAccess().GetHttpClient()
	res, err := client.Do(request)
	if err != nil {
		debugLogger.Err(err).Msg("Failed to send Analytics")
		return
	}
	defer func() {
		_ = res.Body.Close()
	}()

	successfullySend := 200 <= res.StatusCode && res.StatusCode < 300
	if successfullySend {
		debugLogger.Print("Analytics successfully send")
	} else {
		debugLogger.Print("Failed to send Analytics:", res.Status)
	}
}

func sendInstrumentation(ctx context.Context, eng workflow.Engine, instrumentor analytics.InstrumentationCollector, logger *zerolog.Logger) {
	// Avoid duplicate data to be sent for IDE integrations that use the CLI
	if !shallSendInstrumentation(eng.GetConfiguration(), instrumentor) {
		logger.Print("This CLI call is not instrumented!")
		return
	}

	// add temporary static nodejs binary flag, remove once linuxstatic is official
	staticNodeJsBinaryBool, parseErr := strconv.ParseBool(constants.StaticNodeJsBinary)
	if parseErr != nil {
		logger.Print("Failed to parse staticNodeJsBinary:", parseErr)
	} else {
		// the legacycli:: prefix is added to maintain compatibility with our monitoring dashboard
		instrumentor.AddExtension("legacycli::static-nodejs-binary", staticNodeJsBinaryBool)
	}

	logger.Print("Sending Instrumentation")
	data, err := analytics.GetV2InstrumentationObject(instrumentor, analytics.WithLogger(logger))
	if err != nil {
		logger.Err(err).Msg("Failed to derive data object")
	}

	v2InstrumentationData := utils.ValueOf(json.Marshal(data))
	localConfiguration := globalConfiguration.Clone()
	// the report analytics workflow needs --experimental to run
	// we pass the flag here so that we report at every interaction
	localConfiguration.Set(configuration.FLAG_EXPERIMENTAL, true)
	localConfiguration.Set("inputData", string(v2InstrumentationData))
	_, err = eng.Invoke(
		localworkflows.WORKFLOWID_REPORT_ANALYTICS,
		workflow.WithConfig(localConfiguration),
		workflow.WithContext(ctx),
	)

	if err != nil {
		logger.Err(err).Msg("Failed to send Instrumentation")
	} else {
		logger.Print("Instrumentation successfully sent")
	}
}
