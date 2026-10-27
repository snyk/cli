package core

// !!! This import needs to be the first import, please do not change this !!!
import _ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"
import (
	"github.com/snyk/cli/cliv2/internal/helpdocs"
	"github.com/snyk/cli/cliv2/internal/helprouting"
)

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
	"github.com/snyk/cli-extension-dep-graph/v2/pkg/ecosystems/orchestrator"
	"github.com/snyk/error-catalog-golang-public/cli"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	"github.com/snyk/go-application-framework/pkg/ui/consoleui"

	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/instrumentation"
	"github.com/snyk/go-application-framework/pkg/logging"

	"github.com/snyk/cli/cliv2/cmd/cliv2/behavior/legacy"
	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"

	persona "github.com/snyk/cli/cliv2/internal/persona"
	"github.com/snyk/cli/cliv2/internal/persona/agent"
	cliv2utils "github.com/snyk/cli/cliv2/internal/utils"

	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/local_workflows/config_utils"
	"github.com/snyk/go-application-framework/pkg/local_workflows/network_utils"

	"github.com/snyk/go-application-framework/pkg/local_workflows/output_workflow"
	"github.com/snyk/go-application-framework/pkg/networking"
	"github.com/snyk/go-application-framework/pkg/networking/middleware"
	"github.com/snyk/go-application-framework/pkg/runtimeinfo"
	"github.com/snyk/go-application-framework/pkg/ui"
	"github.com/snyk/go-application-framework/pkg/ui/uitypes"
	"github.com/snyk/go-application-framework/pkg/utils"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/snyk/go-httpauth/pkg/httpauth"

	cli_errors "github.com/snyk/cli/cliv2/internal/errors"
	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
)

// Option configures the CLI runner.
type Option func(*runnerConfig)

type runnerConfig struct {
	additionalExtensions []workflow.ExtensionInit
}

// WithAdditionalExtensions adds extension initializers to the CLI beyond the
// core set.  This is the hook used by the enterprise/private entry point.
func WithAdditionalExtensions(exts ...workflow.ExtensionInit) Option {
	return func(c *runnerConfig) {
		c.additionalExtensions = append(c.additionalExtensions, exts...)
	}
}

// Run is the public entry point for the CLI. It accepts options to customise
// behaviour — most notably WithAdditionalExtensions for injecting private
// extension initializers.
func Run(opts ...Option) int {
	cfg := &runnerConfig{}
	for _, opt := range opts {
		opt(cfg)
	}
	return mainWithErrorCode(cfg.additionalExtensions)
}

// internalOS is build-scoped: it is injected at build time (see the Makefile) and never changes at runtime.
var internalOS string

// cliRun is what one run of the CLI works on. It is created once per run and handed to the commands and to the
// teardown, so every function says what it uses. Only what is injected at build time (internalOS) is kept
// outside of it.
type cliRun struct {
	engine       workflow.Engine
	config       configuration.Configuration
	logger       *zerolog.Logger
	helpProvided bool

	// interactionId identifies this run. It is sent as a URN, see instrumentation.AssembleUrnFromUUID.
	interactionId string
}

const (
	unknownCommandMessage     string = "unknown command"
	disable_analytics_flag    string = "DISABLE_ANALYTICS"
	debug_level_flag          string = "log-level"
	integrationNameFlag       string = "integration-name"
	maxNetworkRequestAttempts string = "max-attempts"
	teardownTimeout                  = 5 * time.Second

	codeUseUfmConfigKey   string = "internal_code_use_ufm"
	ufmPresenterConfigKey string = "internal_use_ufm_presenter"
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
	config.AddAlternativeKeys(middleware.ConfigurationKeyRequestAttempts, []string{"snyk_max_attempts", maxNetworkRequestAttempts})
	config.AddAlternativeKeys(cliv2.ConfigKeyRequestConcurrency, []string{"snyk_request_concurrency"})
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

	// Only positional args before "--" are input directories. Everything after "--" is
	// passthrough (e.g. build-tool flags like `-s settings.xml`) and must not leak into
	// INPUT_DIRECTORY, otherwise it gets misread as a path/package and force-routes to legacy.
	// cobra appends the post-"--" tokens as the suffix of args, so trim them off.
	positionalArgs := args
	if len(doubleDashArgs) > 0 && len(args) >= len(doubleDashArgs) {
		positionalArgs = args[:len(args)-len(doubleDashArgs)]
	}

	if len(positionalArgs) > 0 {
		config.Set(configuration.INPUT_DIRECTORY, positionalArgs)
		config.Set(localworkflows.ConfigurationNewAuthenticationToken, positionalArgs[0])
	}
}

// main workflow
func (r *cliRun) runCommand(cmd *cobra.Command, args []string) error {
	// since cobra doesn't tell us if -- was found, os.Args is required in addition
	return r.runMainWorkflow(cmd, args, os.Args)
}

func (r *cliRun) runMainWorkflow(cmd *cobra.Command, args []string, rawArgs []string) error {
	err := r.config.AddFlagSet(cmd.Flags())
	if err != nil {
		r.logger.Print("Failed to add flags", err)
		return err
	}

	// init UI
	errorUI := consoleui.WithErrorOutput(os.Stdout)
	if output_workflow.DefaultOutputIsStructured(r.config) {
		errorUI = consoleui.WithErrorOutput(os.Stderr)
	}
	mainUI := consoleui.New(consoleui.WithInput(os.Stdin), consoleui.WithOutput(os.Stdout), consoleui.WithProgressWriter(os.Stderr), errorUI)
	r.engine.SetUserInterface(mainUI)

	// global handling of experimental commands
	if config_utils.IsExperimental(cmd.Flags()) {
		if !r.config.GetBool(configuration.FLAG_EXPERIMENTAL) {
			return cli.NewCommandIsExperimentalError(getFullCommandString(cmd))
		}
	}

	updateConfigFromParameter(r.config, args, rawArgs)

	name := getFullCommandString(cmd)
	r.logger.Print("Running ", name)
	r.engine.GetAnalytics().SetCommand(name)

	err = runWorkflowAndProcessData(cmd.Context(), r.engine, r.logger, name)

	return err
}

func runWorkflowAndProcessData(ctx context.Context, engine workflow.Engine, logger *zerolog.Logger, name string) error {
	ic := engine.GetAnalytics().GetInstrumentation()

	output, err := engine.Invoke(workflow.NewWorkflowIdentifier(name), workflow.WithContext(ctx), workflow.WithInstrumentationCollector(ic))
	if err != nil {
		logger.Print("Failed to execute the command! ", err)
		return err
	}

	outputFiltered, err := engine.Invoke(localworkflows.WORKFLOWID_FILTER_FINDINGS, workflow.WithContext(ctx), workflow.WithInput(output), workflow.WithInstrumentationCollector(ic))
	if err != nil {
		logger.Err(err).Msg(err.Error())
		return err
	}

	_, err = engine.Invoke(localworkflows.WORKFLOWID_OUTPUT_WORKFLOW, workflow.WithContext(ctx), workflow.WithInput(outputFiltered), workflow.WithInstrumentationCollector(ic))
	if err == nil {
		err = getErrorFromWorkFlowData(engine, outputFiltered)
	}
	return err
}

func (r *cliRun) defaultCmd(args []string) error {
	inputDirectory := cliv2.DetermineInputDirectory(args)
	if len(inputDirectory) > 0 {
		r.config.Set(configuration.INPUT_DIRECTORY, inputDirectory)
	}

	// prepare the invocation of the legacy CLI by
	// * enabling stdio
	// * by specifying the raw cmd args for it
	r.config.Set(configuration.WORKFLOW_USE_STDIO, true)
	r.config.Set(configuration.RAW_CMD_ARGS, args)
	_, err := r.engine.Invoke(basic_workflows.WORKFLOWID_LEGACY_CLI)
	return err
}

func (r *cliRun) runLegacyHelp() error {
	filteredArgs := utils.RemoveSimilar(os.Args[1:], "--")
	return r.defaultCmd(append(filteredArgs, "--help"))
}

func (r *cliRun) runTestCommandWithSarifEqualJson(cmd *cobra.Command, args []string) error {
	configureSarifEqualJSON(r.config)
	return r.runCommand(cmd, args)
}

func configureSarifEqualJSON(config configuration.Configuration) {
	// ensure legacy behavior, where sarif and json can be used interchangeably
	config.AddAlternativeKeys(output_workflow.OUTPUT_CONFIG_KEY_SARIF, []string{output_workflow.OUTPUT_CONFIG_KEY_JSON})

	// TemplateFiles stay empty so the output workflow picks the templates matching the data model (LFM or UFM)
	fileWriters := []output_workflow.FileWriter{
		{
			NameConfigKey:     output_workflow.OUTPUT_CONFIG_KEY_SARIF_FILE,
			MimeType:          output_workflow.SARIF_MIME_TYPE,
			TemplateFiles:     nil,
			WriteEmptyContent: true,
		},
		{
			NameConfigKey:     output_workflow.OUTPUT_CONFIG_KEY_JSON_FILE,
			MimeType:          output_workflow.SARIF_MIME_TYPE,
			TemplateFiles:     nil,
			WriteEmptyContent: false,
		},
		{
			NameConfigKey:     output_workflow.OUTPUT_CONFIG_KEY_HTML_FILE,
			MimeType:          output_workflow.HTML_MIME_TYPE,
			TemplateFiles:     nil,
			WriteEmptyContent: true,
		},
	}
	config.Set(output_workflow.OUTPUT_CONFIG_KEY_FILE_WRITERS, fileWriters)

	// ensure that json is translated to sarif for the default writer as well
	defaultWriterLookup := map[string]string{
		output_workflow.JSON_MIME_TYPE: output_workflow.SARIF_MIME_TYPE,
	}
	config.Set(output_workflow.OUTPUT_CONFIG_KEY_DEFAULT_WRITER_LUT, defaultWriterLookup)
}

func isHtmlOutput(flags *pflag.FlagSet) bool {
	html, _ := flags.GetBool(output_workflow.OUTPUT_CONFIG_KEY_HTML)
	htmlFile, _ := flags.GetString(output_workflow.OUTPUT_CONFIG_KEY_HTML_FILE)
	return html || htmlFile != ""
}

func (r *cliRun) runOSTestCommand(cmd *cobra.Command, args []string) error {
	if !r.config.IsSet(ufmPresenterConfigKey) {
		r.config.Set(ufmPresenterConfigKey, true)
	}

	if isHtmlOutput(cmd.Flags()) {
		r.config.Set(ufmPresenterConfigKey, true)
		r.config.Set(orchestrator.FlagUnifiedTestAPIOsCLI.Key, true)
	}

	return r.runCommand(cmd, args)
}

func (r *cliRun) runCodeTestCommand(cmd *cobra.Command, args []string) error {
	if isHtmlOutput(cmd.Flags()) {
		r.config.Set(codeUseUfmConfigKey, true)
	}
	return r.runTestCommandWithSarifEqualJson(cmd, args)
}

func (r *cliRun) runSecretsTestCommand(cmd *cobra.Command, args []string) error {
	return r.runTestCommandWithSarifEqualJson(cmd, args)
}

func (r *cliRun) runAuthCommand(cmd *cobra.Command, args []string) error {
	err := r.runCommand(cmd, args)

	reloadError := r.config.ReloadConfig()
	if reloadError != nil {
		r.logger.Err(reloadError).Msg("Failed to reload the configuration after authentication.")
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
	globalFLags.Int(maxNetworkRequestAttempts, -1, "Maximum total network attempts, including the initial request (minimum: 1)")
	return globalFLags
}

func emptyCommandFunction(_ *cobra.Command, _ []string) error {
	return fmt.Errorf("%s", unknownCommandMessage)
}

func (r *cliRun) createCommandsForWorkflows(rootCommand *cobra.Command) {
	workflowIdList := r.engine.GetWorkflows()
	commandMap := make(map[string]*cobra.Command)
	for i := range workflowIdList {
		currentId := workflowIdList[i]
		currentCommandString := workflow.GetCommandFromWorkflowIdentifier(currentId)

		workflowEntry, _ := r.engine.GetWorkflow(currentId)

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
		parentCommand.RunE = r.runCommand
		parentCommand.Hidden = !workflowEntry.IsVisible()
		parentCommand.DisableFlagParsing = false

		// special case for snyk code test
		switch currentCommandString {
		case "code test":
			// to preserve backwards compatibility we will need to relax flag validation
			parentCommand.FParseErrWhitelist.UnknownFlags = true

			// use the special run command to ensure that the non-standard behavior of the command can be kept
			parentCommand.RunE = r.runCodeTestCommand
		case "secrets test":
			// use the special run command to ensure that the non-standard behavior of the command can be kept
			parentCommand.RunE = r.runSecretsTestCommand
		case "test":
			legacy.SetupTestMonitorCommand(parentCommand)
			parentCommand.RunE = r.runOSTestCommand
		case "monitor":
			legacy.SetupTestMonitorCommand(parentCommand)
		case "auth":
			parentCommand.RunE = r.runAuthCommand
		case "agent-scan":
			// to preserve backwards compatibility we will need to relax flag validation
			parentCommand.FParseErrWhitelist.UnknownFlags = true
			parentCommand.Aliases = []string{"mcp-scan"}
		case "fix":
			// to preserve backwards compatibility we will need to relax flag validation
			parentCommand.FParseErrWhitelist.UnknownFlags = true
		}
	}
}

func (r *cliRun) prepareRootCommand(router *helprouting.Router) *cobra.Command {
	rootCommand := cobra.Command{
		Use: "snyk",
		RunE: func(cmd *cobra.Command, _ []string) error {
			return r.defaultCmd(os.Args[1:])
		},
	}

	// Help precedence: synced user-doc Markdown (legacy CLI) when available; otherwise Cobra help.
	root := &rootCommand
	helpCommand := cobra.Command{
		Use: "help",
		RunE: func(c *cobra.Command, _ []string) error {
			return router.Help(c, root, os.Args[1:])
		},
	}

	// some static/global cobra configuration
	rootCommand.CompletionOptions.DisableDefaultCmd = true
	rootCommand.SilenceErrors = true
	rootCommand.SilenceUsage = true
	rootCommand.FParseErrWhitelist.UnknownFlags = true

	rootCommand.SetHelpFunc(func(c *cobra.Command, _ []string) { _ = router.Help(c, root, os.Args[1:]) })
	rootCommand.SetHelpCommand(&helpCommand)
	rootCommand.PersistentFlags().AddFlagSet(getGlobalFLags())

	return &rootCommand
}

func (r *cliRun) handleError(err error) HandleError {
	resultError := handleErrorUnhandled
	preCondition := err != nil && !r.helpProvided

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
			// handle flag errors explicitly via help(): user-doc markdown when available, otherwise Cobra help
			resultError = handleErrorShowHelp
		}
	}

	return resultError
}

func doctorTip(isCI bool) string {
	if isCI {
		return "Give the snyk doctor your logs to debug: `snyk doctor --input <log-file>`"
	}
	return "Try snyk doctor: `snyk <command> -d 2>&1 | snyk doctor --stdin`"
}

func (r *cliRun) displayError(ctx context.Context, err error, userInterface ui.UserInterface, isCI bool) {
	if err != nil {
		_, isExitError := err.(*exec.ExitError)
		_, isErrorWithCode := err.(*cli_errors.ErrorWithExitCode)
		if isExitError || isErrorWithCode || errorHasBeenShown(err) {
			return
		}

		if r.config.GetBool(output_workflow.OUTPUT_CONFIG_KEY_JSON) {
			message := getErrorMessage(err)

			jsonError := JsonErrorStruct{
				Ok:       false,
				ErrorMsg: message,
				Path:     r.config.GetString(configuration.INPUT_DIRECTORY),
			}

			jsonErrorBuffer, _ := json.MarshalIndent(jsonError, "", "  ")
			// This document is the command's structured output, so it goes to
			// stdout; OutputError would route it to stderr in structured mode.
			_ = userInterface.Output(string(jsonErrorBuffer))
		} else {
			ctx = context.WithValue(ctx, uitypes.ErrorTipKey, doctorTip(isCI))
			uiError := userInterface.OutputError(err, ui.WithContext(ctx))
			if uiError != nil {
				r.logger.Err(uiError).Msg("ui failed to show error")
			}
		}
	}
}

func handleRetryNotification(engine workflow.Engine, logger *zerolog.Logger, err error) {
	if userInterface := engine.GetUserInterface(); userInterface != nil {
		if outputErr := userInterface.OutputError(err); outputErr != nil {
			logger.Warn().Err(outputErr).Msg("failed to show rate-limit retry warning")
		}
	} else {
		logger.Warn().Msg("rate-limit retry warning not shown: user interface not attached")
	}

	if engineAnalytics := engine.GetAnalytics(); engineAnalytics != nil {
		engineAnalytics.AddError(err)
	} else {
		logger.Warn().Msg("rate-limit retry not recorded in analytics: collector not initialized")
	}
}

// tearDown handles sending analytics and instrumentation
// It is used both for normal exit and signal-triggered exit
func (r *cliRun) tearDown(ctx context.Context, err error, errorList []error, startTime time.Time, ua networking.UserAgentInfo, cliAnalytics analytics.Analytics) int {
	// Create a context with timeout for teardown operations to ensure we don't hang indefinitely
	teardownCtx, cancel := context.WithTimeout(ctx, teardownTimeout)
	defer cancel()

	// Populated here (post-command) rather than at startup so the analytics scrub chokepoint
	// (which reads logging.REDACTION_TERMS off of config) sees these terms on every run, not
	// just under --debug, without forcing an ORGANIZATION/ORGANIZATION_SLUG network lookup
	// before the command's own requests run.
	populateRedactionTerms(r.config, r.engine)

	outputError := err
	allErrors := errorList

	if cli_errors.IsFailure(err) {
		allErrors, outputError = processError(err, errorList)
	}

	for _, tempError := range allErrors {
		if tempError != nil {
			cliAnalytics.AddError(tempError)
		}
	}

	exitCode := cliv2.DeriveExitCode(outputError)
	r.logger.Printf("Deriving Exit Code %d (cause: %v)", exitCode, outputError)

	r.displayError(ctx, outputError, r.engine.GetUserInterface(), cliAnalytics.IsCiEnvironment())

	r.updateInstrumentationDataBeforeSending(cliAnalytics, startTime, ua, exitCode)

	if !r.config.GetBool(configuration.ANALYTICS_DISABLED) {
		r.sendAnalytics(teardownCtx, cliAnalytics)
	}
	r.sendInstrumentation(teardownCtx, cliAnalytics.GetInstrumentation())

	// cleanup resources in use
	// WARNING: deferred actions will execute AFTER cleanup; only defer if not impacted by this
	if _, cleanupErr := r.engine.Invoke(basic_workflows.WORKFLOWID_GLOBAL_CLEANUP, workflow.WithContext(teardownCtx)); cleanupErr != nil {
		r.logger.Printf("Failed to cleanup %v", cleanupErr)
	}

	if r.config.GetBool(configuration.DEBUG) {
		r.writeLogFooter(exitCode, allErrors)
	}

	return exitCode
}

func mainWithErrorCode(additionalExts []workflow.ExtensionInit) int {
	_, exitCode := execute(additionalExts)
	return exitCode
}

// execute runs the CLI and returns what the run worked on together with the exit code.
func execute(additionalExts []workflow.ExtensionInit) (*cliRun, int) {
	initDebugBuild()

	noopLogger := zerolog.New(io.Discard)
	r := &cliRun{logger: &noopLogger, interactionId: instrumentation.AssembleUrnFromUUID(uuid.NewString())}

	errorList := []error{}
	errorListMutex := sync.Mutex{}
	var finalExitCode int

	// preparing the possibility to tearDown from different threads while ensure it is only called once
	var tearDownOnce sync.Once

	// init context
	ctx := context.Background()
	ctx = context.WithValue(ctx, networking.InteractionIdKey, instrumentation.AssembleUrnFromUUID(r.interactionId))

	startTime := time.Now()
	var err error
	rInfo := runtimeinfo.New(runtimeinfo.WithName("snyk-cli"), runtimeinfo.WithVersion(cliv2.GetFullVersion()))

	helpDocs := helpdocs.DefaultCommandHelp()
	helpRouter := &helprouting.Router{
		LegacyHelp:   r.runLegacyHelp,
		OnHelpCalled: func() { r.helpProvided = true },
		HasUserDoc:   helpDocs.HasUserDoc,
	}
	rootCommand := r.prepareRootCommand(helpRouter)
	// omit the first arg which is always `snyk`
	_ = rootCommand.ParseFlags(os.Args[1:])

	// create engine
	r.config = configuration.NewWithOpts(
		configuration.WithFiles("snyk"),
		configuration.WithSupportedEnvVars("NODE_EXTRA_CA_CERTS"),
		configuration.WithSupportedEnvVarPrefixes("snyk_", "internal_", "test_"),
		configuration.WithCachingEnabled(configuration.NoCacheExpiration),
	)
	err = r.config.AddFlagSet(rootCommand.LocalFlags())
	if err != nil {
		_, _ = fmt.Fprintln(os.Stderr, "Failed to add flags to root command", err)
	}

	// ensure to init configuration before using it
	initApplicationConfiguration(r.config)

	debugEnabled := r.config.GetBool(configuration.DEBUG)

	var scrubbedLogger logging.ScrubbingLogWriter
	r.logger, scrubbedLogger = initDebugLogger(r.config)
	r.engine = app.CreateAppEngineWithOptions(app.WithZeroLogger(r.logger), app.WithConfiguration(r.config), app.WithRuntimeInfo(rInfo))

	r.config.AddDefaultValue(configuration.FF_OAUTH_AUTH_FLOW_ENABLED, defaultOAuthFF(r.config))
	r.config.AddDefaultValue(configuration.FF_TRANSFORMATION_WORKFLOW, configuration.StandardDefaultValueFunction(true))
	r.config.AddDefaultValue(configuration.NETWORK_REQUEST_RETRY_ALLOWED_PATHS, defaultNetworkRequestRetryAllowedPaths())

	if noProxyAuth := r.config.GetBool(basic_workflows.PROXY_NOAUTH); noProxyAuth {
		r.config.Set(configuration.PROXY_AUTHENTICATION_MECHANISM, httpauth.StringFromAuthenticationMechanism(httpauth.NoAuth))
	}

	// init NetworkAccess
	ua := networking.UserAgent(networking.UaWithConfig(r.config), networking.UaWithRuntimeInfo(rInfo), networking.UaWithOS(internalOS))
	networkAccess := r.engine.GetNetworkAccess()
	networkAccess.AddErrorHandler(func(err error, ctx context.Context) error {
		if err == nil {
			return nil
		}

		// Retry notifications arrive as catalog errors with RetryAttemptError as cause.
		// Show UI warning, record in analytics, but don't collect as a command error.
		var retryErr *middleware.RetryAttemptError
		if errors.As(err, &retryErr) {
			handleRetryNotification(r.engine, r.logger, err)
			return nil
		}

		errorListMutex.Lock()
		defer errorListMutex.Unlock()

		errorList = append(errorList, err)
		return err
	})
	networkAccess.AddHeaderField("x-snyk-cli-version", cliv2.GetFullVersion())
	networkAccess.AddHeaderField("snyk-interaction-id", instrumentation.AssembleUrnFromUUID(r.interactionId))
	networkAccess.AddHeaderField(
		"User-Agent",
		ua.String(),
	)
	network_utils.AddSnykRequestId(networkAccess)

	// initialize the extensions -> they register themselves at the engine
	initExtensions(r.engine, r.config, additionalExts)

	// init engine
	err = r.engine.Init()

	// We want to scrub the debug log of sensitive information. Since we have a list of commands we know can occur, we can intersect that with arguments we don't recognize, and automatically scrub all those from the logs.
	if debugEnabled {
		termsToRedact := populateRedactionTerms(r.config, r.engine)
		scrubbedLogger.AddTermsToReplace(termsToRedact)
		r.writeLogHeader()
	}

	if err != nil {
		r.logger.Print("Failed to init Workflow Engine!", err)
		return r, constants.SNYK_EXIT_CODE_ERROR
	}

	// add output flags as persistent flags
	outputWorkflow, _ := r.engine.GetWorkflow(localworkflows.WORKFLOWID_OUTPUT_WORKFLOW)
	outputFlags := workflow.FlagsetFromConfigurationOptions(outputWorkflow.GetConfigurationOptions())
	rootCommand.PersistentFlags().AddFlagSet(outputFlags)

	// add workflows as commands
	r.createCommandsForWorkflows(rootCommand)

	// init Analytics
	cliAnalytics := r.engine.GetAnalytics()
	cliAnalytics.SetVersion(cliv2.GetFullVersion())
	cliAnalytics.SetCmdArguments(os.Args)
	cliAnalytics.SetOperatingSystem(internalOS)
	cliAnalytics.GetInstrumentation().SetUserAgent(ua)
	cliAnalytics.GetInstrumentation().SetInteractionId(instrumentation.AssembleUrnFromUUID(r.interactionId))
	cliAnalytics.GetInstrumentation().SetCategory(instrumentation.DetermineCategory(os.Args, r.engine))
	cliAnalytics.GetInstrumentation().SetStage(instrumentation.DetermineStage(cliAnalytics.IsCiEnvironment()))
	cliAnalytics.GetInstrumentation().SetStatus(analytics.Success)
	persona.Report(cliAnalytics)

	r.setTimeout(func() {
		tearDownOnce.Do(func() {
			errorListMutex.Lock()
			errorListCopy := append([]error{}, errorList...)
			errorListMutex.Unlock()

			exitCode := r.tearDown(ctx, context.DeadlineExceeded, errorListCopy, startTime, ua, cliAnalytics)
			os.Exit(exitCode)
		})
	})

	// run the extensible cli
	err = rootCommand.ExecuteContext(ctx)

	// fallback to the legacy cli or show help
	handleErrorResult := r.handleError(err)
	switch handleErrorResult {
	case handleErrorFallbackToLegacyCLI:
		// when falling back to TS cli, make sure the
		_ = rootCommand.ParseFlags(os.Args)
		if err := r.config.AddFlagSet(rootCommand.LocalFlags()); err != nil {
			r.logger.Printf("failed to add flagset: %v", err)
		}

		r.logger.Printf("Using Legacy CLI to serve the command. (reason: %v)", err)
		err = r.defaultCmd(os.Args[1:])
	case handleErrorShowHelp:
		err = helpRouter.Help(nil, rootCommand, os.Args[1:])
	case handleErrorUnhandled:
		// ignore
	}

	tearDownOnce.Do(func() {
		errorListMutex.Lock()
		errorListCopy := append([]error{}, errorList...)
		errorListMutex.Unlock()

		finalExitCode = r.tearDown(ctx, err, errorListCopy, startTime, ua, cliAnalytics)
	})

	return r, finalExitCode
}

// populateRedactionTerms computes likely-secret literal values (unrecognized CLI
// arguments and environment variables) and records them on config under
// logging.REDACTION_TERMS, so the analytics scrub chokepoint can redact
// them regardless of whether debug logging is enabled.
func populateRedactionTerms(config configuration.Configuration, engine workflow.Engine) []string {
	knownTerms, _ := instrumentation.GetKnownCommandsAndFlags(engine)
	knownTerms = append(knownTerms, config.GetString(configuration.API_URL), config.GetString(configuration.ORGANIZATION), config.GetString(configuration.ORGANIZATION_SLUG), config.GetString(configuration.INTEGRATION_NAME), config.GetString(configuration.INTEGRATION_VERSION), config.GetString(configuration.INTEGRATION_ENVIRONMENT), config.GetString(configuration.INTEGRATION_ENVIRONMENT_VERSION), config.GetString(clientMachineIdConfigKey), config.GetString(AgentSessionIdConfigKey))
	// AI_AGENT is trusted verbatim by agent.DetectAgent, and persona.Report
	// falls back to that same raw value whenever the Harness name/version split
	// or canonicalisation does not apply, so its raw value needs the same
	// exclusion as the client machine id above. GetUnknownParameters tokenizes
	// its input on whitespace, so a multi-word value only excludes as a whole if
	// each of its words is excluded too. persona.Report reports the canonical
	// name and version from SplitVersion, which can differ from the raw value
	// (e.g. "claude-code_2-1-310_agent" -> "claude_code" / "2.1.310"), so those
	// are excluded as well, or any env var or argument that happens to equal
	// them gets the reported values redacted to ***.
	if detectedAgent, ok := agent.DetectAgent(); ok {
		name, version := agent.SplitVersion(detectedAgent)
		knownTerms = append(knownTerms, detectedAgent, name, version)
		knownTerms = append(knownTerms, strings.Fields(detectedAgent)...)
	}
	// Without an override, resolving the machine id here could create the machine id file just to build redaction terms.
	if config.IsSet(configuration.MACHINE_ID) {
		knownTerms = append(knownTerms, config.GetString(configuration.MACHINE_ID))
	}
	termsToRedact := cliv2utils.GetUnknownParameters(os.Args[1:], os.Environ(), knownTerms)
	config.Set(logging.REDACTION_TERMS, termsToRedact)
	return termsToRedact
}

func processError(err error, errorList []error) ([]error, error) {
	// ensure to use generic fallback error catalog error if no other is available
	resultError := decorateError(err)
	resultErrorList := errorList

	// filter legacycli terminate errors since it is only used for internal purposes
	if exitErr, isExitError := resultError.(*exec.ExitError); isExitError && exitErr.ExitCode() == constants.SNYK_EXIT_CODE_TS_CLI_TERMINATED {
		resultError = nil
	}

	// ensure to have all errors in the list for analytics, determining the most relevant error to surface to the user ...
	if resultError != nil {
		resultErrorList = append([]error{resultError}, resultErrorList...)
	}

	// determine the most relevant error to surface to the user and derive the exit code from
	resultError = cli_errors.FindMostRelevantError(resultErrorList)

	// ensure to apply exit code mapping based on errors
	if exitCode := mapErrorToExitCode(resultError); exitCode != unsetExitCode {
		resultError = createErrorWithExitCode(exitCode, resultError)
	}
	return resultErrorList, resultError
}

func (r *cliRun) setTimeout(onTimeout func()) {
	timeout := r.config.GetInt(configuration.TIMEOUT)
	if timeout == 0 {
		return
	}
	r.logger.Printf("Command timeout set for %d seconds", timeout)
	go func() {
		const gracePeriodForSubProcesses = 3
		<-time.After(time.Duration(timeout+gracePeriodForSubProcesses) * time.Second)
		onTimeout()
	}()
}
