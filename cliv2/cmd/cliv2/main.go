package main

import (
	"io/ioutil"
	"log"
	"os"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/pkg/basic_workflows"
	"github.com/snyk/go-application-framework/pkg/analytics"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/snyk/go-httpauth/pkg/httpauth"
	"github.com/spf13/cobra"
	"github.com/spf13/pflag"
)

var engine workflow.Engine
var config configuration.Configuration
var helpProvided bool

func getDebugLogger(config configuration.Configuration) *log.Logger {
	debugLogger := log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)
	debug := config.GetBool(configuration.DEBUG)

	if !debug {
		debugLogger.SetOutput(ioutil.Discard)
	}

	return debugLogger
}

func main() {
	args := basic_workflows.FilteredArgs()
	errorCode := MainWithErrorCode(args)
	os.Exit(errorCode)
}

// main workflow
func runCommand(cmd *cobra.Command, args []string) error {
	//fmt.Println("runCommand()", cmd)
	return nil
}

func sendAnalytics(analytics analytics.Analytics, debugLogger *log.Logger) {
	debugLogger.Println("Sending Analytics")

	_, err := analytics.Send()
	if err == nil {
		debugLogger.Println("Analytics sucessfully send")
	} else {
		debugLogger.Println("Failed to send Analytics", err)
	}
}

func usage(cmd *cobra.Command) error {
	// just ensure to do nothing when incorrectly used from cobra side
	return nil
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

	// ensure that help and usage information comes from the legacy cli instead of cobra's default help
	rootCommand.SetHelpFunc(help)
	rootCommand.SetUsageFunc(usage)
	rootCommand.SetHelpCommand(&helpCommand)
	rootCommand.PersistentFlags().AddFlagSet(getGlobalFLags())
	return &rootCommand
}

func MainWithErrorCode(args []string) int {
	var err error

	rootCommand := prepareRootCommand()
	rootCommand.ParseFlags(os.Args)

	config = configuration.New()
	config.AddFlagSet(rootCommand.Flags())

	debugLogger := getDebugLogger(config)

	if noProxyAuth := config.GetBool(basic_workflows.PROXY_NOAUTH); noProxyAuth {
		config.Set(configuration.PROXY_AUTHENTICATION_MECHANISM, httpauth.StringFromAuthenticationMechanism(httpauth.NoAuth))
	}

	// create engine
	engine = workflow.NewWorkFlowEngine(config)

	// initialize the extensions -> they register themselves at the engine
	basic_workflows.Init(engine)

	// init engine
	err = engine.Init()
	if err != nil {
		return constants.SNYK_EXIT_CODE_ERROR
	}

	// add workflows as commands
	createCommandsForWorkflows(rootCommand, engine)

	debugLogger.Println("Organization:", config.GetString(configuration.ORGANIZATION))
	debugLogger.Println("API:", config.GetString(configuration.API_URL))

	// init NetworkAccess
	networkAccess := engine.GetNetworkAccess()
	networkAccess.AddHeaderField("x-snyk-cli-version", cliv2.GetFullVersion())

	// init Analytics
	cliAnalytics := engine.GetAnalytics()
	cliAnalytics.SetVersion(cliv2.GetFullVersion())
	cliAnalytics.SetCmdArguments(args)
	if config.GetBool(configuration.ANALYTICS_DISABLED) == false {
		defer sendAnalytics(cliAnalytics, debugLogger)
	}

	// run the extensible cli
	err = rootCommand.Execute()

	// fallback to the legacy cli
	if err != nil && helpProvided == false {
		debugLogger.Printf("Falling back to legacy cli. (reason: %v)\n", err)
		err = defaultCmd(nil, []string{})
	}

	if err != nil {
		cliAnalytics.AddError(err)
	}

	exitCode := cliv2.DeriveExitCode(err)
	debugLogger.Printf("Exiting with %d\n", exitCode)

	return exitCode
}
