package main

// !!! This import needs to be the first import, please do not change this !!!
import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"sync"
	"time"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/snyk/cli-extension-ai-bom/pkg/aibom"
	"github.com/snyk/cli-extension-ai-bom/pkg/redteam"
	"github.com/snyk/cli-extension-dep-graph/pkg/depgraph"
	"github.com/snyk/cli-extension-iac-rules/iacrules"
	"github.com/snyk/cli-extension-iac/pkg/iac"
	"github.com/snyk/cli-extension-mcp-scan/pkg/mcpscan"
	"github.com/snyk/cli-extension-os-flows/pkg/osflows"
	"github.com/snyk/cli-extension-sbom/pkg/sbom"
	"github.com/snyk/cli/cliv2/cmd/cliv2/behavior/legacy"
	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	featureflaggateway "github.com/snyk/cli/cliv2/internal/feature-flag-gateway"
	"github.com/snyk/container-cli/pkg/container"
	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/instrumentation"
	"github.com/snyk/go-application-framework/pkg/logging"
	_ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	cliv2utils "github.com/snyk/cli/cliv2/internal/utils"

	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/local_workflows/config_utils"
	"github.com/snyk/go-application-framework/pkg/local_workflows/network_utils"

	workflows "github.com/snyk/go-application-framework/pkg/local_workflows/connectivity_check_extension"
	"github.com/snyk/go-httpauth/pkg/httpauth"
	"github.com/snyk/snyk-iac-capture/pkg/capture"

	ignoreworkflow "github.com/snyk/go-application-framework/pkg/local_workflows/ignore_workflow"
	"github.com/snyk/go-application-framework/pkg/local_workflows/output_workflow"
	"github.com/snyk/go-application-framework/pkg/networking"
	"github.com/snyk/go-application-framework/pkg/runtimeinfo"
	"github.com/snyk/go-application-framework/pkg/ui"
	"github.com/snyk/go-application-framework/pkg/utils"
	"github.com/snyk/go-application-framework/pkg/workflow"

	snykls "github.com/snyk/snyk-ls/ls_extension"
	"github.com/snyk/studio-mcp/pkg/mcp"

	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
)

var internalOS string
var globalEngine workflow.Engine
var globalConfiguration configuration.Configuration
var helpProvided bool

var noopLogger zerolog.Logger = zerolog.New(io.Discard)
var globalLogger *zerolog.Logger = &noopLogger
var scrubbedLogger logging.ScrubbingLogWriter
var interactionId = instrumentation.AssembleUrnFromUUID(uuid.NewString())

const (
	unknownCommandMessage   string = "unknown command"
	disable_analytics_flag  string = "DISABLE_ANALYTICS"
	debug_level_flag        string = "log-level"
	integrationNameFlag     string = "integration-name"
	showMavenBuildScopeFlag string = "show-maven-build-scope"
)

type JsonErrorStruct struct {
	Ok       bool   `json:"ok"`
	ErrorMsg string `json:"error"`
	Path     string `json:"path"`
}

type HandleError int

const (
	handleErrorFallbackToLegacyCLI HandleError = iota
	handleErrorShowHelp            HandleError = iota
	handleErrorUnhandled           HandleError = iota
)

func main() {
	errorCode := MainWithErrorCode()
	os.Exit(errorCode)
}

// Initialize the given configuration with CLI specific aspects
func initApplicationConfiguration(config configuration.Configuration) {
	config.AddAlternativeKeys(configuration.AUTHENTICATION_TOKEN, []string{"snyk_cfg_api", "api"})
	config.AddAlternativeKeys(configuration.AUTHENTICATION_BEARER_TOKEN, []string{"snyk_docker_token"})
	config.AddAlternativeKeys(configuration.API_URL, []string{"endpoint"})
	config.AddAlternativeKeys(configuration.ADD_TRUSTED_CA_FILE, []string{"NODE_EXTRA_CA_CERTS"})
	config.AddAlternativeKeys(configuration.ANALYTICS_DISABLED, []string{strings.ToLower(constants.SNYK_ANALYTICS_DISABLED_ENV), "snyk_cfg_disable_analytics", "disable-analytics", "disable_analytics"})
	config.AddAlternativeKeys(configuration.ORGANIZATION, []string{"snyk_cfg_org"})
	config.AddAlternativeKeys(configuration.PREVIEW_FEATURES_ENABLED, []string{"snyk_preview"})
	config.AddAlternativeKeys(configuration.LOG_LEVEL, []string{debug_level_flag})
	config.AddAlternativeKeys(configuration.INTEGRATION_NAME, []string{integrationNameFlag})
}

func getFullCommandString(cmd *cobra.Command) string {
	fullCommandPath := []string{cmd.Name()}
	fn := func(c *cobra.Command) {
		if c.HasParent() {
			fullCommandPath = append(fullCommandPath, c.Name())
		}
	}
	cmd.VisitParents(fn)

	for i, j := 0, len(fullCommandPath)-1; i < j; i, j = i+1, j-1 {
		fullCommandPath[i], fullCommandPath[j] = fullCommandPath[j], fullCommandPath[i]
	}

	name := strings.Join(fullCommandPath, " ")
	return name
}

func updateConfigFromParameter(config configuration.Configuration, args []string, rawArgs []string) {
	// extract everything behind --
	doubleDashArgs := []string{}
	doubleDashFound := false
	for _, v := range rawArgs {
		if doubleDashFound {
			doubleDashArgs = append(doubleDashArgs, v)
		} else if v == "--" {
			doubleDashFound = true
		}
	}
	config.Set(configuration.UNKNOWN_ARGS, doubleDashArgs)

	// only consider the first positional argument as input directory if it is not behind a double dash.
	if len(args) > 0 && !utils.Contains(doubleDashArgs, args[0]) {
		config.Set(configuration.INPUT_DIRECTORY, args)
		config.Set(localworkflows.ConfigurationNewAuthenticationToken, args[0])
	}
}

// main workflow
func runCommand(cmd *cobra.Command, args []string) error {
	// since cobra doesn't tell us if -- was found, os.Args is required in addition
	return runMainWorkflow(globalConfiguration, cmd, args, os.Args)
}

func runMainWorkflow(config configuration.Configuration, cmd *cobra.Command, args []string, rawArgs []string) error {
	err := config.AddFlagSet(cmd.Flags())
	if err != nil {
		globalLogger.Print("Failed to add flags", err)
		return err
	}

	// global handling of experimental commands
	if config_utils.IsExperimental(cmd.Flags()) {
		if !globalConfiguration.GetBool(configuration.FLAG_EXPERIMENTAL) {
			return cli.NewCommandIsExperimentalError(getFullCommandString(cmd))
		}
	}

	updateConfigFromParameter(config, args, rawArgs)

	name := getFullCommandString(cmd)
	globalLogger.Print("Running ", name)
	globalEngine.GetAnalytics().SetCommand(name)

	err = runWorkflowAndProcessData(globalEngine, globalLogger, name)

	return err
}

func runWorkflowAndProcessData(engine workflow.Engine, logger *zerolog.Logger, name string) error {
	ic := engine.GetAnalytics().GetInstrumentation()

	output, err := engine.Invoke(workflow.NewWorkflowIdentifier(name), workflow.WithInstrumentationCollector(ic))
	if err != nil {
		logger.Print("Failed to execute the command!", err)
		return err
	}

	outputFiltered, err := engine.Invoke(localworkflows.WORKFLOWID_FILTER_FINDINGS, workflow.WithInput(output), workflow.WithInstrumentationCollector(ic))
	if err != nil {
		logger.Err(err).Msg(err.Error())
		return err
	}

	_, err = engine.Invoke(localworkflows.WORKFLOWID_OUTPUT_WORKFLOW, workflow.WithInput(outputFiltered), workflow.WithInstrumentationCollector(ic))
	if err == nil {
		err = getErrorFromWorkFlowData(engine, outputFiltered)
	}
	return err
}

func sendAnalytics(analytics analytics.Analytics, debugLogger *zerolog.Logger) {
	debugLogger.Print("Sending Analytics")

	analytics.SetApiUrl(globalConfiguration.GetString(configuration.API_URL))

	res, err := analytics.Send()
	if err != nil {
		debugLogger.Err(err).Msg("Failed to send Analytics")
		return
	}
	defer res.Body.Close()

	successfullySend := 200 <= res.StatusCode && res.StatusCode < 300
	if successfullySend {
		debugLogger.Print("Analytics successfully send")
	} else {
		var details string
		if res != nil {
			details = res.Status
		}

		debugLogger.Print("Failed to send Analytics:", details)
	}
}

func sendInstrumentation(eng workflow.Engine, instrumentor analytics.InstrumentationCollector, logger *zerolog.Logger) {
	// Avoid duplicate data to be sent for IDE integrations that use the CLI
	if !shallSendInstrumentation(eng.GetConfiguration(), instrumentor) {
		logger.Print("This CLI call is not instrumented!")
		return
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
	_, err = eng.InvokeWithConfig(
		localworkflows.WORKFLOWID_REPORT_ANALYTICS,
		localConfiguration,
	)

	if err != nil {
		logger.Err(err).Msg("Failed to send Instrumentation")
	} else {
		logger.Print("Instrumentation successfully sent")
	}
}

func help(_ *cobra.Command, _ []string) error {
	helpProvided = true
	args := utils.RemoveSimilar(os.Args[1:], "--") // remove all double dash arguments to avoid issues with the help command
	args = append(args, "--help")
	return defaultCmd(args)
}

func defaultCmd(args []string) error {
	inputDirectory := cliv2.DetermineInputDirectory(args)
	if len(inputDirectory) > 0 {
		globalConfiguration.Set(configuration.INPUT_DIRECTORY, inputDirectory)
	}

	// prepare the invocation of the legacy CLI by
	// * enabling stdio
	// * by specifying the raw cmd args for it
	globalConfiguration.Set(configuration.WORKFLOW_USE_STDIO, true)
	globalConfiguration.Set(configuration.RAW_CMD_ARGS, args)
	_, err := globalEngine.Invoke(basic_workflows.WORKFLOWID_LEGACY_CLI)
	return err
}

func runCodeTestCommand(cmd *cobra.Command, args []string) error {
	// ensure legacy behavior, where sarif and json can be used interchangeably
	globalConfiguration.AddAlternativeKeys(output_workflow.OUTPUT_CONFIG_KEY_SARIF, []string{output_workflow.OUTPUT_CONFIG_KEY_JSON})

	fileWriters := []output_workflow.FileWriter{
		{
			NameConfigKey:     output_workflow.OUTPUT_CONFIG_KEY_SARIF_FILE,
			MimeType:          output_workflow.SARIF_MIME_TYPE,
			TemplateFiles:     output_workflow.ApplicationSarifTemplates,
			WriteEmptyContent: true,
		},
		{
			NameConfigKey:     output_workflow.OUTPUT_CONFIG_KEY_JSON_FILE,
			MimeType:          output_workflow.SARIF_MIME_TYPE,
			TemplateFiles:     output_workflow.ApplicationSarifTemplates,
			WriteEmptyContent: false,
		},
	}
	globalConfiguration.Set(output_workflow.OUTPUT_CONFIG_KEY_FILE_WRITERS, fileWriters)

	// ensure that json is translated to sarif for the default writer as well
	defaultWriterLookup := map[string]string{
		output_workflow.JSON_MIME_TYPE: output_workflow.SARIF_MIME_TYPE,
	}
	globalConfiguration.Set(output_workflow.OUTPUT_CONFIG_KEY_DEFAULT_WRITER_LUT, defaultWriterLookup)

	return runCommand(cmd, args)
}

func runAuthCommand(cmd *cobra.Command, args []string) error {
	err := runCommand(cmd, args)

	reloadError := globalConfiguration.ReloadConfig()
	if reloadError != nil {
		globalLogger.Err(reloadError).Msg("Failed to reload the configuration after authentication.")
	}

	return err
}

func getGlobalFLags() *pflag.FlagSet {
	globalConfigurationOptions := workflow.GetGlobalConfiguration()
	globalFLags := workflow.FlagsetFromConfigurationOptions(globalConfigurationOptions)
	globalFLags.Bool(basic_workflows.PROXY_NOAUTH, false, "")
	globalFLags.Bool(disable_analytics_flag, false, "")
	globalFLags.String(debug_level_flag, "debug", "")
	globalFLags.String(integrationNameFlag, "", "")
	return globalFLags
}

func emptyCommandFunction(_ *cobra.Command, _ []string) error {
	return fmt.Errorf("%s", unknownCommandMessage)
}

func createCommandsForWorkflows(rootCommand *cobra.Command, engine workflow.Engine) {
	workflowIdList := engine.GetWorkflows()
	commandMap := make(map[string]*cobra.Command)
	for i := range workflowIdList {
		currentId := workflowIdList[i]
		currentCommandString := workflow.GetCommandFromWorkflowIdentifier(currentId)

		workflowEntry, _ := engine.GetWorkflow(currentId)

		workflowOptions := workflowEntry.GetConfigurationOptions()
		flagset := workflow.FlagsetFromConfigurationOptions(workflowOptions)

		workflowParts := strings.Split(currentCommandString, " ")

		parentCommand := rootCommand
		var currentParts string
		for level := 0; level < len(workflowParts); level++ {
			subCmdName := workflowParts[level]
			currentParts += " " + subCmdName
			subCmd := commandMap[currentParts]
			if subCmd == nil {
				subCmd = &cobra.Command{
					Use:                subCmdName,
					Hidden:             true,
					RunE:               emptyCommandFunction, // ensure to trigger the fallback case
					DisableFlagParsing: true,                 // disable flag parsing to allow arbitrary flags for commands that will trigger the fallback
				}
				parentCommand.AddCommand(subCmd)
				commandMap[currentParts] = subCmd
			}
			parentCommand = subCmd
		}

		// last parentCommand is the last level of the command, e.g. in the snyk iac capture workflow, it would be 'capture'
		// we add flags and command line only to that one
		if flagset != nil {
			parentCommand.Flags().AddFlagSet(flagset)
		}
		parentCommand.RunE = runCommand
		parentCommand.Hidden = !workflowEntry.IsVisible()
		parentCommand.DisableFlagParsing = false

		// special case for snyk code test
		if currentCommandString == "code test" {
			// to preserve backwards compatibility we will need to relax flag validation
			parentCommand.FParseErrWhitelist.UnknownFlags = true

			// use the special run command to ensure that the non-standard behavior of the command can be kept
			parentCommand.RunE = runCodeTestCommand
		} else if currentCommandString == "test" || currentCommandString == "monitor" {
			legacy.SetupTestMonitorCommand(parentCommand)
		} else if currentCommandString == "auth" {
			parentCommand.RunE = runAuthCommand
		}
	}
}

func prepareRootCommand() *cobra.Command {
	rootCommand := cobra.Command{
		Use: "snyk",
		RunE: func(cmd *cobra.Command, _ []string) error {
			return defaultCmd(os.Args[1:])
		},
	}

	// help for all commands is handled by the legacy cli
	// TODO: discuss how to move help to extensions
	helpCommand := cobra.Command{
		Use:  "help",
		RunE: help,
	}

	// some static/global cobra configuration
	rootCommand.CompletionOptions.DisableDefaultCmd = true
	rootCommand.SilenceErrors = true
	rootCommand.SilenceUsage = true
	rootCommand.FParseErrWhitelist.UnknownFlags = true

	// ensure that help and usage information comes from the legacy cli instead of cobra's default help
	rootCommand.SetHelpFunc(func(c *cobra.Command, args []string) { _ = help(c, args) })
	rootCommand.SetHelpCommand(&helpCommand)
	rootCommand.PersistentFlags().AddFlagSet(getGlobalFLags())

	return &rootCommand
}

func handleError(err error) HandleError {
	resultError := handleErrorUnhandled
	preCondition := err != nil && !helpProvided

	// Cases:
	// - error from extension -> ignore
	// - error unknown command -> fallback
	// - error known command but unknown flag -> help

	if preCondition {
		errString := err.Error()
		flagError := strings.Contains(errString, "unknown flag") ||
			strings.Contains(errString, "flag needs") ||
			strings.Contains(errString, "invalid argument")
		commandError := strings.Contains(errString, unknownCommandMessage)

		// filter for known cobra errors, since cobra errors shall trigger a fallback, but not others.
		if commandError {
			resultError = handleErrorFallbackToLegacyCLI
		} else if flagError {
			// handle flag errors explicitly since we need to delegate the help to the legacy CLI. This includes disabling the cobra default help/usage
			resultError = handleErrorShowHelp
		}
	}

	return resultError
}

func displayError(err error, userInterface ui.UserInterface, config configuration.Configuration, ctx context.Context) {
	if err != nil {
		_, isExitError := err.(*exec.ExitError)
		_, isErrorWithCode := err.(*cli_errors.ErrorWithExitCode)
		if isExitError || isErrorWithCode || errorHasBeenShown(err) {
			return
		}

		if config.GetBool(output_workflow.OUTPUT_CONFIG_KEY_JSON) {
			message := getErrorMessage(err)

			jsonError := JsonErrorStruct{
				Ok:       false,
				ErrorMsg: message,
				Path:     globalConfiguration.GetString(configuration.INPUT_DIRECTORY),
			}

			jsonErrorBuffer, _ := json.MarshalIndent(jsonError, "", "  ")
			userInterface.Output(string(jsonErrorBuffer))
		} else {
			if errors.Is(err, context.DeadlineExceeded) {
				err = fmt.Errorf("command timed out")
			}
			uiError := userInterface.OutputError(err, ui.WithContext(ctx))
			if uiError != nil {
				globalLogger.Err(uiError).Msg("ui failed to show error")
			}
		}
	}
}

func MainWithErrorCode() int {
	initDebugBuild()

	errorList := []error{}
	errorListMutex := sync.Mutex{}

	startTime := time.Now()
	var err error
	rInfo := runtimeinfo.New(runtimeinfo.WithName("snyk-cli"), runtimeinfo.WithVersion(cliv2.GetFullVersion()))

	rootCommand := prepareRootCommand()
	// omit the first arg which is always `snyk`
	_ = rootCommand.ParseFlags(os.Args[1:])

	// create engine
	globalConfiguration = configuration.NewWithOpts(
		configuration.WithFiles("snyk"),
		configuration.WithSupportedEnvVars("NODE_EXTRA_CA_CERTS"),
		configuration.WithSupportedEnvVarPrefixes("snyk_", "internal_", "test_"),
		configuration.WithCachingEnabled(configuration.NoCacheExpiration),
	)
	err = globalConfiguration.AddFlagSet(rootCommand.LocalFlags())
	if err != nil {
		fmt.Fprintln(os.Stderr, "Failed to add flags to root command", err)
	}

	// ensure to init configuration before using it
	initApplicationConfiguration(globalConfiguration)

	debugEnabled := globalConfiguration.GetBool(configuration.DEBUG)

	globalLogger, scrubbedLogger = initDebugLogger(globalConfiguration)
	globalEngine = app.CreateAppEngineWithOptions(app.WithZeroLogger(globalLogger), app.WithConfiguration(globalConfiguration), app.WithRuntimeInfo(rInfo))

	globalConfiguration.AddDefaultValue(configuration.FF_OAUTH_AUTH_FLOW_ENABLED, defaultOAuthFF(globalConfiguration))
	globalConfiguration.AddDefaultValue(configuration.FF_TRANSFORMATION_WORKFLOW, configuration.StandardDefaultValueFunction(true))

	if noProxyAuth := globalConfiguration.GetBool(basic_workflows.PROXY_NOAUTH); noProxyAuth {
		globalConfiguration.Set(configuration.PROXY_AUTHENTICATION_MECHANISM, httpauth.StringFromAuthenticationMechanism(httpauth.NoAuth))
	}

	// init NetworkAccess
	ua := networking.UserAgent(networking.UaWithConfig(globalConfiguration), networking.UaWithRuntimeInfo(rInfo), networking.UaWithOS(internalOS))
	networkAccess := globalEngine.GetNetworkAccess()
	networkAccess.AddErrorHandler(func(err error, ctx context.Context) error {
		errorListMutex.Lock()
		defer errorListMutex.Unlock()

		errorList = append(errorList, err)
		return err
	})
	networkAccess.AddHeaderField("x-snyk-cli-version", cliv2.GetFullVersion())
	networkAccess.AddHeaderField("snyk-interaction-id", instrumentation.AssembleUrnFromUUID(interactionId))
	networkAccess.AddHeaderField(
		"User-Agent",
		ua.String(),
	)
	network_utils.AddSnykRequestId(networkAccess)

	if debugEnabled {
		writeLogHeader(globalConfiguration, networkAccess)
	}

	// initialize the extensions -> they register themselves at the engine
	globalEngine.AddExtensionInitializer(basic_workflows.Init)
	globalEngine.AddExtensionInitializer(osflows.Init)
	globalEngine.AddExtensionInitializer(iac.Init)
	globalEngine.AddExtensionInitializer(sbom.Init)
	globalEngine.AddExtensionInitializer(aibom.Init)
	globalEngine.AddExtensionInitializer(redteam.Init)
	globalEngine.AddExtensionInitializer(depgraph.Init)
	globalEngine.AddExtensionInitializer(capture.Init)
	globalEngine.AddExtensionInitializer(iacrules.Init)
	globalEngine.AddExtensionInitializer(snykls.Init)
	globalEngine.AddExtensionInitializer(mcp.Init)
	globalEngine.AddExtensionInitializer(container.Init)
	globalEngine.AddExtensionInitializer(workflows.InitConnectivityCheckWorkflow)
	globalEngine.AddExtensionInitializer(localworkflows.InitCodeWorkflow)
	globalEngine.AddExtensionInitializer(ignoreworkflow.InitIgnoreWorkflows)
	globalEngine.AddExtensionInitializer(mcpscan.Init)

	// init engine
	err = globalEngine.Init()

	// We want to scrub the debug log of sensitive information. Since we have a list of commands we know can occur, we can intersect that with arguments we don't recognize, and automatically scrub all those from the logs.
	if debugEnabled {
		knownTerms, _ := instrumentation.GetKnownCommandsAndFlags(globalEngine)
		knownTerms = append(knownTerms, globalConfiguration.GetString(configuration.API_URL), globalConfiguration.GetString(configuration.ORGANIZATION), globalConfiguration.GetString(configuration.ORGANIZATION_SLUG))
		termsToRedact := cliv2utils.GetUnknownParameters(os.Args[1:], os.Environ(), knownTerms)
		scrubbedLogger.AddTermsToReplace(termsToRedact)
	}

	if err != nil {
		globalLogger.Print("Failed to init Workflow Engine!", err)
		return constants.SNYK_EXIT_CODE_ERROR
	}

	// init context
	ctx := context.Background()
	ctx = context.WithValue(ctx, networking.InteractionIdKey, instrumentation.AssembleUrnFromUUID(interactionId))

	// add output flags as persistent flags
	outputWorkflow, _ := globalEngine.GetWorkflow(localworkflows.WORKFLOWID_OUTPUT_WORKFLOW)
	outputFlags := workflow.FlagsetFromConfigurationOptions(outputWorkflow.GetConfigurationOptions())
	rootCommand.PersistentFlags().AddFlagSet(outputFlags)

	// add workflows as commands
	createCommandsForWorkflows(rootCommand, globalEngine)

	// fetch feature flags
	ffgService, err := featureflaggateway.NewService(globalConfiguration.GetUrl(configuration.API_URL), 10*time.Second)
	if err != nil {
		globalLogger.Print("Failed to fetch feature flags", err)
		return constants.SNYK_EXIT_CODE_ERROR
	}
	apiToken := globalConfiguration.GetString(configuration.AUTHENTICATION_TOKEN)

	// init Analytics
	cliAnalytics := globalEngine.GetAnalytics()
	cliAnalytics.SetVersion(cliv2.GetFullVersion())
	cliAnalytics.SetCmdArguments(os.Args)
	cliAnalytics.SetOperatingSystem(internalOS)
	cliAnalytics.GetInstrumentation().SetUserAgent(ua)
	cliAnalytics.GetInstrumentation().SetInteractionId(instrumentation.AssembleUrnFromUUID(interactionId))
	cliAnalytics.GetInstrumentation().SetCategory(instrumentation.DetermineCategory(os.Args, globalEngine))
	cliAnalytics.GetInstrumentation().SetStage(instrumentation.DetermineStage(cliAnalytics.IsCiEnvironment()))
	cliAnalytics.GetInstrumentation().SetStatus(analytics.Success)
	cliAnalytics.GetInstrumentation().AddExtension(showMavenBuildScopeFlag,
		IsFeatureEnabled(ctx, ffgService, globalConfiguration.GetString(configuration.ORGANIZATION), showMavenBuildScopeFlag, apiToken))

	setTimeout(globalConfiguration, func() {
		os.Exit(constants.SNYK_EXIT_CODE_EX_UNAVAILABLE)
	})

	// run the extensible cli
	err = rootCommand.Execute()

	// fallback to the legacy cli or show help
	handleErrorResult := handleError(err)
	if handleErrorResult == handleErrorFallbackToLegacyCLI {
		// when falling back to TS cli, make sure the
		_ = rootCommand.ParseFlags(os.Args)
		globalConfiguration.AddFlagSet(rootCommand.LocalFlags())

		globalLogger.Printf("Using Legacy CLI to serve the command. (reason: %v)", err)
		err = defaultCmd(os.Args[1:])
	} else if handleErrorResult == handleErrorShowHelp {
		err = help(nil, []string{})
	}

	if err != nil {
		err = decorateError(err)

		errorList = append(errorList, err)
		for _, tempError := range errorList {
			cliAnalytics.AddError(tempError)
		}

		err = legacyCLITerminated(err, errorList)
	}

	displayError(err, globalEngine.GetUserInterface(), globalConfiguration, ctx)

	exitCode := cliv2.DeriveExitCode(err)
	globalLogger.Printf("Deriving Exit Code %d (cause: %v)", exitCode, err)

	updateInstrumentationDataBeforeSending(cliAnalytics, startTime, ua, exitCode)

	if !globalConfiguration.GetBool(configuration.ANALYTICS_DISABLED) {
		sendAnalytics(cliAnalytics, globalLogger)
	}
	sendInstrumentation(globalEngine, cliAnalytics.GetInstrumentation(), globalLogger)

	// cleanup resources in use
	// WARNING: deferred actions will execute AFTER cleanup; only defer if not impacted by this
	_, err = globalEngine.Invoke(basic_workflows.WORKFLOWID_GLOBAL_CLEANUP)
	if err != nil {
		globalLogger.Printf("Failed to cleanup %v", err)
	}

	if debugEnabled {
		writeLogFooter(exitCode, errorList, globalConfiguration, networkAccess)
	}

	return exitCode
}

func IsFeatureEnabled(
	ctx context.Context,
	service featureflaggateway.Service,
	orgID string,
	flag string,
	token string,
) bool {
	resp, err := service.EvaluateFlags(ctx, []string{flag}, orgID, "2024-10-15", token)
	if err != nil || resp == nil {
		return false
	}
	evals := resp.Data.Attributes.Evaluations
	for _, e := range evals {
		if e.Key == flag {
			return e.Value
		}
	}
	return false
}

func legacyCLITerminated(err error, errorList []error) error {
	exitErr, isExitError := err.(*exec.ExitError)
	if isExitError && exitErr.ExitCode() == constants.SNYK_EXIT_CODE_TS_CLI_TERMINATED {
		errorList = append([]error{err}, errorList...)
		err = errors.Join(errorList...)
	}
	return err
}

func setTimeout(config configuration.Configuration, onTimeout func()) {
	timeout := config.GetInt(configuration.TIMEOUT)
	if timeout == 0 {
		return
	}
	globalLogger.Printf("Command timeout set for %d seconds", timeout)
	go func() {
		const gracePeriodForSubProcesses = 3
		<-time.After(time.Duration(timeout+gracePeriodForSubProcesses) * time.Second)
		fmt.Fprintf(os.Stdout, "command timed out")
		onTimeout()
	}()
}
