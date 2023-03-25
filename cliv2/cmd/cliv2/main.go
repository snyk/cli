package main

import (
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"runtime"
	"strings"

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
var debugLogger = log.New(os.Stderr, "", 0)

const unknownCommandMessage string = "unknown command"

func getDebugLogger(config configuration.Configuration) *log.Logger {
	debug := config.GetBool(configuration.DEBUG)
	if !debug {
		debugLogger.SetOutput(io.Discard)
	} else {
		debugFlags := config.GetInt(configuration.DEBUG_FORMAT)
		debugLogger.SetFlags(debugFlags)
		debugLogger.SetPrefix("main - ")
	}

	return debugLogger
}

func main() {
	errorCode := MainWithErrorCode()
	os.Exit(errorCode)
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
		debugLogger.Println("Failed to add flags", err)
		return err
	}

	name := getFullCommandString(cmd)
	debugLogger.Println("Running", name)

	if len(args) > 0 {
		config.Set("targetDirectory", args[0])
	}

	data, err := engine.Invoke(workflow.NewWorkflowIdentifier(name))
	if err == nil {
		_, err = engine.InvokeWithInput(workflow.NewWorkflowIdentifier("output"), data)
	} else {
		debugLogger.Println("Failed to execute the command!", err)
	}

	return err
}

func sendAnalytics(analytics analytics.Analytics, debugLogger *log.Logger) {
	debugLogger.Println("Sending Analytics")

	res, err := analytics.Send()
	successfullySend := res != nil && 200 <= res.StatusCode && res.StatusCode < 300
	if err == nil && successfullySend {
		debugLogger.Println("Analytics sucessfully send")
	} else {
		var details string
		if res != nil {
			details = res.Status
		} else if err != nil {
			details = err.Error()
		}

		debugLogger.Println("Failed to send Analytics:", details)
	}
}

func help(cmd *cobra.Command, args []string) {
	helpProvided = true
	defaultCmd(cmd, args) // TODO handle error
}

func defaultCmd(cmd *cobra.Command, args []string) error {
	config.Set(configuration.WORKFLOW_USE_STDIO, true)
	_, err := engine.Invoke(basic_workflows.WORKFLOWID_LEGACY_CLI)
	return err
}

func getGlobalFLags() *pflag.FlagSet {
	globalConfiguration := workflow.GetGlobalConfiguration()
	globalFLags := workflow.FlagsetFromConfigurationOptions(globalConfiguration)
	globalFLags.Bool(basic_workflows.PROXY_NOAUTH, false, "")
	return globalFLags
}

func emptyCommandFunction(cmd *cobra.Command, args []string) error {
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
	}

	// help for all commands is handled by the legacy cli
	// TODO: discuss how to move help to extensions
	helpCommand := cobra.Command{
		Use: "help",
		Run: help,
	}

	// some static/global cobra configuration
	rootCommand.CompletionOptions.DisableDefaultCmd = true
	rootCommand.SilenceErrors = true
	rootCommand.SilenceUsage = true
	rootCommand.FParseErrWhitelist.UnknownFlags = true

	// ensure that help and usage information comes from the legacy cli instead of cobra's default help
	rootCommand.SetHelpFunc(help)
	rootCommand.SetHelpCommand(&helpCommand)
	rootCommand.PersistentFlags().AddFlagSet(getGlobalFLags())

	return &rootCommand
}

func doFallback(err error) (fallback bool) {
	fallback = false
	preCondition := err != nil && helpProvided == false
	if preCondition {
		errString := err.Error()
		flagError := strings.Contains(errString, "unknown flag") ||
			strings.Contains(errString, "flag needs") ||
			strings.Contains(errString, "invalid argument")
		commandError := strings.Contains(errString, unknownCommandMessage)

		// filter for known cobra errors, since cobra errors shall trigger a fallback, but not others.
		if commandError || flagError {
			fallback = true
		}
	}

	return fallback
}

func displayError(err error) {
	if err != nil {
		if _, ok := err.(*exec.ExitError); !ok {
			fmt.Println(err)
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

	if config.GetBool(configuration.OAUTH_AUTH_ENABLED) {
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
	engine = app.CreateAppEngine()
	config = engine.GetConfiguration()
	err = config.AddFlagSet(rootCommand.LocalFlags())
	if err != nil {
		debugLogger.Println("Failed to add flags to root command", err)
	}

	debugEnabled := config.GetBool(configuration.DEBUG)
	debugLogger := getDebugLogger(config)

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
		debugLogger.Println("Failed to init Workflow Engine!", err)
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

	extraCaCertFile := config.GetString(constants.SNYK_CA_CERTIFICATE_LOCATION_ENV)
	if len(extraCaCertFile) > 0 {
		err = networkAccess.AddRootCAs(extraCaCertFile)
		if err != nil {
			debugLogger.Printf("Failed to AddRootCAs from '%s' (%v)\n", extraCaCertFile, err)
		} else {
			debugLogger.Println("Using additional CAs from file:", extraCaCertFile)
		}
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

	// fallback to the legacy cli
	if doFallback(err) {
		debugLogger.Printf("Using Legacy CLI to serve the command. (reason: %v)\n", err)
		err = defaultCmd(nil, []string{})
	}

	if err != nil {
		cliAnalytics.AddError(err)
	}

	displayError(err)

	exitCode := cliv2.DeriveExitCode(err)
	debugLogger.Printf("Exiting with %d\n", exitCode)

	return exitCode
}
