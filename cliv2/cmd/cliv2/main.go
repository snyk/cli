package main

import (
	"crypto/sha256"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/snyk/cli-extension-sbom/pkg/sbom"
	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/networking"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/snyk/go-httpauth/pkg/httpauth"
	"github.com/snyk/snyk-iac-capture/pkg/capture"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

var engine workflow.Engine
var config configuration.Configuration
var helpProvided bool
var debugLogger = zerolog.New(zerolog.ConsoleWriter{
	Out:        os.Stderr,
	TimeFormat: time.RFC3339,
	NoColor:    true,
	PartsOrder: []string{
		zerolog.TimestampFieldName,
		"ext",
		"separator",
		zerolog.CallerFieldName,
		zerolog.MessageFieldName,
	},
	FieldsExclude: []string{"ext", "separator"},
	FormatTimestamp: func(i interface{}) string {
		t, _ := time.Parse(time.RFC3339, i.(string))
		return strings.ToUpper(fmt.Sprintf("%s", t.UTC().Format(time.RFC3339)))
	},
}).With().Str("ext", "main").Str("separator", "-").Timestamp().Logger()

const unknownCommandMessage string = "unknown command"

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

func getDebugLogger(config configuration.Configuration) *zerolog.Logger {
	debug := config.GetBool(configuration.DEBUG)
	if !debug {
		debugLogger = debugLogger.Output(io.Discard)
	}

	return &debugLogger
}

func main() {
	errorCode := MainWithErrorCode()
	os.Exit(errorCode)
}

// Initialize the given configuration with CLI specific aspects
func initApplicationConfiguration(config configuration.Configuration) {
	config.AddAlternativeKeys(configuration.AUTHENTICATION_TOKEN, []string{"snyk_token", "snyk_cfg_api", "api"})
	config.AddAlternativeKeys(configuration.AUTHENTICATION_BEARER_TOKEN, []string{"snyk_oauth_token", "snyk_docker_token"})
	config.AddAlternativeKeys(configuration.API_URL, []string{"endpoint"})
	config.AddAlternativeKeys(configuration.ADD_TRUSTED_CA_FILE, []string{"NODE_EXTRA_CA_CERTS"})
	config.AddAlternativeKeys(configuration.ANALYTICS_DISABLED, []string{"snyk_analytics_disabled", "disable-analytics", "disable_analytics", "snyk_cfg_disable_analytics"})

	// if the CONFIG_KEY_OAUTH_TOKEN is specified as env var, we don't apply any additional logic
	_, ok := os.LookupEnv(auth.CONFIG_KEY_OAUTH_TOKEN)
	if !ok {
		alternativeBearerKeys := config.GetAlternativeKeys(configuration.AUTHENTICATION_BEARER_TOKEN)
		for _, key := range alternativeBearerKeys {
			hasPrefix := strings.HasPrefix(key, "snyk_")
			if hasPrefix {
				formattedKey := strings.ToUpper(key)
				_, ok := os.LookupEnv(formattedKey)
				if ok {
					debugLogger.Printf("Found environment variable %s, disabling OAuth flow", formattedKey)
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

// main workflow
func runCommand(cmd *cobra.Command, args []string) error {

	err := config.AddFlagSet(cmd.Flags())
	if err != nil {
		debugLogger.Print("Failed to add flags", err)
		return err
	}

	name := getFullCommandString(cmd)
	debugLogger.Print("Running ", name)

	if len(args) > 0 {
		config.Set(configuration.INPUT_DIRECTORY, args[0])
	}

	data, err := engine.Invoke(workflow.NewWorkflowIdentifier(name))
	if err == nil {
		_, err = engine.InvokeWithInput(localworkflows.WORKFLOWID_OUTPUT_WORKFLOW, data)
	} else {
		debugLogger.Print("Failed to execute the command!", err)
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
	args = append(os.Args[1:], "--help")
	return defaultCmd(args)
}

func defaultCmd(args []string) error {
	// prepare the invocation of the legacy CLI by
	// * enabling stdio
	// * by specifying the raw cmd args for it
	config.Set(configuration.WORKFLOW_USE_STDIO, true)
	config.Set(configuration.RAW_CMD_ARGS, args)
	_, err := engine.Invoke(basic_workflows.WORKFLOWID_LEGACY_CLI)
	return err
}

func getGlobalFLags() *pflag.FlagSet {
	globalConfiguration := workflow.GetGlobalConfiguration()
	globalFLags := workflow.FlagsetFromConfigurationOptions(globalConfiguration)
	globalFLags.Bool(basic_workflows.PROXY_NOAUTH, false, "")
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
		if _, ok := err.(*exec.ExitError); !ok {
			if config.GetBool(localworkflows.OUTPUT_CONFIG_KEY_JSON) {
				jsonError := JsonErrorStruct{
					Ok:       false,
					ErrorMsg: err.Error(),
					Path:     config.GetString(configuration.INPUT_DIRECTORY),
				}

				jsonErrorBuffer, _ := json.MarshalIndent(jsonError, "", "  ")
				fmt.Println(string(jsonErrorBuffer))
			} else {
				fmt.Println(err)
			}
		}
	}
}

func logHeaderAuthorizationInfo(config configuration.Configuration, networkAccess networking.NetworkAccess) (string, string) {
	oauthEnabled := "Disabled"
	authorization := ""
	tokenShaSum := ""
	tokenDetails := ""

	apiRequest := &http.Request{
		URL:    config.GetUrl(configuration.API_URL),
		Header: http.Header{},
	}
	err := networkAccess.GetAuthenticator().AddAuthenticationHeader(apiRequest)
	if err != nil {
		return authorization, oauthEnabled
	}

	authHeader := apiRequest.Header.Get("Authorization")
	splitHeader := strings.Split(authHeader, " ")
	if len(splitHeader) == 2 {
		tokenType := splitHeader[0]
		token := splitHeader[1]
		temp := sha256.Sum256([]byte(token))
		tokenShaSum = hex.EncodeToString(temp[0:16]) + "[...]"
		tokenDetails = fmt.Sprintf(" (type=%s)", tokenType)
	}

	if config.GetBool(configuration.FF_OAUTH_AUTH_FLOW_ENABLED) {
		oauthEnabled = "Enabled"
		token, err := auth.GetOAuthToken(config)
		if token != nil && err == nil {
			tokenDetails = fmt.Sprintf(" (type=oauth; expiry=%v)", token.Expiry.UTC())
		}
	}

	authorization = fmt.Sprintf("%s %s", tokenShaSum, tokenDetails)

	return authorization, oauthEnabled
}

func writeLogHeader(config configuration.Configuration, networkAccess networking.NetworkAccess) {
	authorization, oauthEnabled := logHeaderAuthorizationInfo(config, networkAccess)

	org := config.GetString(configuration.ORGANIZATION)
	insecureHTTPS := "false"
	if config.GetBool(configuration.INSECURE_HTTPS) {
		insecureHTTPS = "true"
	}

	tablePrint := func(name string, value string) {
		debugLogger.Printf("%-22s %s", name+":", value)
	}

	tablePrint("Version", cliv2.GetFullVersion())
	tablePrint("Platform", runtime.GOOS+" "+runtime.GOARCH)
	tablePrint("API", config.GetString(configuration.API_URL))
	tablePrint("Cache", config.GetString(configuration.CACHE_PATH))
	tablePrint("Organization", org)
	tablePrint("Insecure HTTPS", insecureHTTPS)
	tablePrint("Authorization", authorization)
	tablePrint("Features", "")
	tablePrint("  --auth-type=oauth", oauthEnabled)

}

func MainWithErrorCode() int {
	var err error

	rootCommand := prepareRootCommand()
	_ = rootCommand.ParseFlags(os.Args)

	// create engine
	config = configuration.New()
	err = config.AddFlagSet(rootCommand.LocalFlags())
	if err != nil {
		debugLogger.Print("Failed to add flags to root command", err)
	}

	debugEnabled := config.GetBool(configuration.DEBUG)
	debugLogger := getDebugLogger(config)

	initApplicationConfiguration(config)
	engine = app.CreateAppEngineWithOptions(app.WithZeroLogger(debugLogger), app.WithConfiguration(config))

	if noProxyAuth := config.GetBool(basic_workflows.PROXY_NOAUTH); noProxyAuth {
		config.Set(configuration.PROXY_AUTHENTICATION_MECHANISM, httpauth.StringFromAuthenticationMechanism(httpauth.NoAuth))
	}

	// initialize the extensions -> they register themselves at the engine
	engine.AddExtensionInitializer(basic_workflows.Init)
	engine.AddExtensionInitializer(sbom.Init)
	engine.AddExtensionInitializer(capture.Init)

	// init engine
	err = engine.Init()
	if err != nil {
		debugLogger.Print("Failed to init Workflow Engine!", err)
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
	networkAccess.AddHeaderField("User-Agent", "snyk-cli/"+cliv2.GetFullVersion())

	if debugEnabled {
		writeLogHeader(config, networkAccess)
	}

	// init Analytics
	cliAnalytics := engine.GetAnalytics()
	cliAnalytics.SetVersion(cliv2.GetFullVersion())
	cliAnalytics.SetCmdArguments(os.Args[1:])
	if config.GetBool(configuration.ANALYTICS_DISABLED) == false {
		defer sendAnalytics(cliAnalytics, debugLogger)
	}

	// run the extensible cli
	err = rootCommand.Execute()

	// fallback to the legacy cli or show help
	handleErrorResult := handleError(err)
	if handleErrorResult == handleErrorFallbackToLegacyCLI {
		debugLogger.Printf("Using Legacy CLI to serve the command. (reason: %v)", err)
		err = defaultCmd(os.Args[1:])
	} else if handleErrorResult == handleErrorShowHelp {
		err = help(nil, []string{})
	}

	if err != nil {
		cliAnalytics.AddError(err)
	}

	displayError(err)

	exitCode := cliv2.DeriveExitCode(err)
	debugLogger.Printf("Exiting with %d", exitCode)

	return exitCode
}
