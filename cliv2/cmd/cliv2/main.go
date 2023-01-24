package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"os/exec"
	"strings"

	"github.com/snyk/cli-extension-sbom/pkg/sbom"
	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/app"
	"github.com/snyk/go-application-framework/pkg/configuration"
	localworkflows "github.com/snyk/go-application-framework/pkg/local_workflows"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/snyk/go-httpauth/pkg/httpauth"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

var engine workflow.Engine
var config configuration.Configuration
var helpProvided bool
var debugLogger = log.New(os.Stderr, "", 0)

func getDebugLogger(config configuration.Configuration) *log.Logger {
	debug := config.GetBool(configuration.DEBUG)
	if !debug {
		debugLogger.SetOutput(ioutil.Discard)
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

	config.AddFlagSet(cmd.Flags())

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
	defaultCmd(cmd, args)
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

func createCommandsForWorkflows(rootCommand *cobra.Command, engine workflow.Engine) {
	workflowIdList := engine.GetWorkflows()
	for i := range workflowIdList {
		currentId := workflowIdList[i]
		currentCommandString := workflow.GetCommandFromWorkflowIdentifier(currentId)
		workflowEntry, _ := engine.GetWorkflow(currentId)

		workflowOptions := workflowEntry.GetConfigurationOptions()
		flagset := workflow.FlagsetFromConfigurationOptions(workflowOptions)

		cmd := cobra.Command{
			Use:    currentCommandString,
			Args:   cobra.MaximumNArgs(1),
			RunE:   runCommand,
			Hidden: !workflowEntry.IsVisible(),
		}

		if flagset != nil {
			cmd.Flags().AddFlagSet(flagset)
		}

		rootCommand.AddCommand(&cmd)
	}
}

func prepareRootCommand() *cobra.Command {
	rootCommand := cobra.Command{
		Use: "snyk",
	}

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

func doFallback(err error, helped bool) (fallback bool) {
	fallback = false
	preCondition := err != nil && helpProvided == false
	if preCondition {
		errString := err.Error()
		flagError := strings.Contains(errString, "unknown flag") ||
			strings.Contains(errString, "flag needs") ||
			strings.Contains(errString, "invalid argument")
		commandError := strings.Contains(errString, "unknown command")

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

func MainWithErrorCode() int {
	var err error

	rootCommand := prepareRootCommand()
	rootCommand.ParseFlags(os.Args)

	// create engine
	engine = app.CreateAppEngine()
	config = engine.GetConfiguration()
	config.AddFlagSet(rootCommand.LocalFlags())

	debugLogger := getDebugLogger(config)

	if noProxyAuth := config.GetBool(basic_workflows.PROXY_NOAUTH); noProxyAuth {
		config.Set(configuration.PROXY_AUTHENTICATION_MECHANISM, httpauth.StringFromAuthenticationMechanism(httpauth.NoAuth))
	}

	// initialize the extensions -> they register themselves at the engine
	engine.AddExtensionInitializer(basic_workflows.Init)
	engine.AddExtensionInitializer(sbom.Init)

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

	debugLogger.Println("Organization:", config.GetString(configuration.ORGANIZATION))
	debugLogger.Println("API:", config.GetString(configuration.API_URL))
	debugLogger.Println("Cache directory:", config.GetString(configuration.CACHE_PATH))
	debugLogger.Println("Insecure HTTPS:", config.GetBool(configuration.INSECURE_HTTPS))

	// init NetworkAccess
	networkAccess := engine.GetNetworkAccess()
	networkAccess.AddHeaderField("x-snyk-cli-version", cliv2.GetFullVersion())

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
	if doFallback(err, helpProvided) {
		debugLogger.Printf("Falling back to legacy cli. (reason: %v)\n", err)
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
