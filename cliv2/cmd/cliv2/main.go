package main

// !!! This import needs to be the first import, please do not change this !!!
import _ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"os"
	"os/exec"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"

	"github.com/snyk/cli-extension-dep-graph/pkg/depgraph"
	"github.com/snyk/cli-extension-iac-rules/iacrules"
	"github.com/snyk/cli-extension-sbom/pkg/sbom"
	"github.com/snyk/container-cli/pkg/container"
	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/networking"
	"github.com/snyk/go-application-framework/pkg/runtimeinfo"
	"github.com/snyk/go-application-framework/pkg/utils"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/snyk/go-httpauth/pkg/httpauth"
	"github.com/snyk/snyk-iac-capture/pkg/capture"
	snykls "github.com/snyk/snyk-ls/ls_extension"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
)

var internalOS string
var engine workflow.Engine
var globalConfiguration configuration.Configuration
var helpProvided bool

var noopLogger zerolog.Logger = zerolog.New(io.Discard)
var globalLogger *zerolog.Logger = &noopLogger

const (
	unknownCommandMessage  string = "unknown command"
	disable_analytics_flag string = "DISABLE_ANALYTICS"
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

	// if the CONFIG_KEY_OAUTH_TOKEN is specified as env var, we don't apply any additional logic
	_, ok := os.LookupEnv(auth.CONFIG_KEY_OAUTH_TOKEN)
	if !ok {
		alternativeBearerKeys := config.GetAlternativeKeys(configuration.AUTHENTICATION_BEARER_TOKEN)
		alternativeBearerKeys = append(alternativeBearerKeys, configuration.AUTHENTICATION_BEARER_TOKEN)
		for _, key := range alternativeBearerKeys {
			hasPrefix := strings.HasPrefix(key, "snyk_")
			if hasPrefix {
				formattedKey := strings.ToUpper(key)
				_, ok := os.LookupEnv(formattedKey)
				if ok {
					globalLogger.Printf("Found environment variable %s, disabling OAuth flow", formattedKey)
					config.Set(configuration.FF_OAUTH_AUTH_FLOW_ENABLED, false)
					break
				}
			}
		}
	}
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
		config.Set(configuration.INPUT_DIRECTORY, args[0])
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

	updateConfigFromParameter(config, args, rawArgs)

	name := getFullCommandString(cmd)
	globalLogger.Print("Running ", name)
	engine.GetAnalytics().SetCommand(name)

	data, err := engine.Invoke(workflow.NewWorkflowIdentifier(name))
	if err == nil {
		_, err = engine.InvokeWithInput(localworkflows.WORKFLOWID_OUTPUT_WORKFLOW, data)
	} else {
		globalLogger.Print("Failed to execute the command!", err)
	}

	return err
}

func sendAnalytics(analytics analytics.Analytics, debugLogger *zerolog.Logger) {
	debugLogger.Print("Sending Analytics")

	res, err := analytics.Send()
	successfullySend := res != nil && 200 <= res.StatusCode && res.StatusCode < 300
	if err == nil && successfullySend {
		debugLogger.Print("Analytics successfully send")
	} else {
		var details string
		if res != nil {
			details = res.Status
		} else if err != nil {
			details = err.Error()
		}

		debugLogger.Print("Failed to send Analytics:", details)
	}
}

func help(_ *cobra.Command, args []string) error {
	helpProvided = true
	args = utils.RemoveSimilar(os.Args[1:], "--") // remove all double dash arguments to avoid issues with the help command
	args = append(args, "--help")
	return defaultCmd(args)
}

func defaultCmd(args []string) error {
	// prepare the invocation of the legacy CLI by
	// * enabling stdio
	// * by specifying the raw cmd args for it
	globalConfiguration.Set(configuration.WORKFLOW_USE_STDIO, true)
	globalConfiguration.Set(configuration.RAW_CMD_ARGS, args)
	_, err := engine.Invoke(basic_workflows.WORKFLOWID_LEGACY_CLI)
	return err
}

func getGlobalFLags() *pflag.FlagSet {
	globalConfigurationOptions := workflow.GetGlobalConfiguration()
	globalFLags := workflow.FlagsetFromConfigurationOptions(globalConfigurationOptions)
	globalFLags.Bool(basic_workflows.PROXY_NOAUTH, false, "")
	globalFLags.Bool(disable_analytics_flag, false, "")
	return globalFLags
}

func emptyCommandFunction(_ *cobra.Command, _ []string) error {
	return fmt.Errorf(unknownCommandMessage)
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
	preCondition := err != nil && helpProvided == false

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

func displayError(err error) {
	if err != nil {
		var exitError *exec.ExitError
		if !errors.As(err, &exitError) {
			if globalConfiguration.GetBool(localworkflows.OUTPUT_CONFIG_KEY_JSON) {
				jsonError := JsonErrorStruct{
					Ok:       false,
					ErrorMsg: err.Error(),
					Path:     globalConfiguration.GetString(configuration.INPUT_DIRECTORY),
				}

				jsonErrorBuffer, _ := json.MarshalIndent(jsonError, "", "  ")
				fmt.Println(string(jsonErrorBuffer))
			} else {
				if errors.Is(err, context.DeadlineExceeded) {
					fmt.Println("command timed out")
				} else {
					fmt.Println(err)
				}
			}
		}
	}
}

func MainWithErrorCode() int {
	var err error
	rInfo := runtimeinfo.New(runtimeinfo.WithName("snyk-cli"), runtimeinfo.WithVersion(cliv2.GetFullVersion()))

	rootCommand := prepareRootCommand()
	_ = rootCommand.ParseFlags(os.Args)

	// create engine
	globalConfiguration = configuration.New()
	err = globalConfiguration.AddFlagSet(rootCommand.LocalFlags())
	if err != nil {
		fmt.Fprintln(os.Stderr, "Failed to add flags to root command", err)
	}

	// ensure to init configuration before using it
	initApplicationConfiguration(globalConfiguration)

	debugEnabled := globalConfiguration.GetBool(configuration.DEBUG)
	globalLogger = initDebugLogger(globalConfiguration)

	engine = app.CreateAppEngineWithOptions(app.WithZeroLogger(globalLogger), app.WithConfiguration(globalConfiguration), app.WithRuntimeInfo(rInfo))

	if noProxyAuth := globalConfiguration.GetBool(basic_workflows.PROXY_NOAUTH); noProxyAuth {
		globalConfiguration.Set(configuration.PROXY_AUTHENTICATION_MECHANISM, httpauth.StringFromAuthenticationMechanism(httpauth.NoAuth))
	}

	// initialize the extensions -> they register themselves at the engine
	engine.AddExtensionInitializer(basic_workflows.Init)
	engine.AddExtensionInitializer(sbom.Init)
	engine.AddExtensionInitializer(depgraph.Init)
	engine.AddExtensionInitializer(capture.Init)
	engine.AddExtensionInitializer(iacrules.Init)
	engine.AddExtensionInitializer(snykls.Init)
	engine.AddExtensionInitializer(container.Init)

	// init engine
	err = engine.Init()
	if err != nil {
		globalLogger.Print("Failed to init Workflow Engine!", err)
		return constants.SNYK_EXIT_CODE_ERROR
	}

	// add output flags as persistent flags
	outputWorkflow, _ := engine.GetWorkflow(localworkflows.WORKFLOWID_OUTPUT_WORKFLOW)
	outputFlags := workflow.FlagsetFromConfigurationOptions(outputWorkflow.GetConfigurationOptions())
	rootCommand.PersistentFlags().AddFlagSet(outputFlags)

	// add workflows as commands
	createCommandsForWorkflows(rootCommand, engine)

	// init NetworkAccess
	networkAccess := engine.GetNetworkAccess()
	networkAccess.AddHeaderField("x-snyk-cli-version", cliv2.GetFullVersion())
	networkAccess.AddHeaderField(
		"User-Agent",
		networking.UserAgent(
			networking.UaWithConfig(globalConfiguration),
			networking.UaWithRuntimeInfo(rInfo),
			networking.UaWithOS(internalOS)).String(),
	)

	if debugEnabled {
		writeLogHeader(globalConfiguration, networkAccess)
	}

	// init Analytics
	cliAnalytics := engine.GetAnalytics()
	cliAnalytics.SetVersion(cliv2.GetFullVersion())
	cliAnalytics.SetCmdArguments(os.Args[1:])
	cliAnalytics.SetOperatingSystem(internalOS)
	if globalConfiguration.GetBool(configuration.ANALYTICS_DISABLED) == false {
		defer sendAnalytics(cliAnalytics, globalLogger)
	}

	setTimeout(globalConfiguration, func() {
		os.Exit(constants.SNYK_EXIT_CODE_EX_UNAVAILABLE)
	})

	// run the extensible cli
	err = rootCommand.Execute()

	// fallback to the legacy cli or show help
	handleErrorResult := handleError(err)
	if handleErrorResult == handleErrorFallbackToLegacyCLI {
		globalLogger.Printf("Using Legacy CLI to serve the command. (reason: %v)", err)
		err = defaultCmd(os.Args[1:])
	} else if handleErrorResult == handleErrorShowHelp {
		err = help(nil, []string{})
	}

	if err != nil {
		cliAnalytics.AddError(err)
	}

	displayError(err)

	exitCode := cliv2.DeriveExitCode(err)
	globalLogger.Printf("Exiting with %d", exitCode)

	return exitCode
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
