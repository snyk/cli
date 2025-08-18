package basic_workflows

import (
	"bufio"
	"bytes"
	"os"
	"os/exec"
	"strconv"

	"github.com/snyk/cli/cliv2/internal/proxy/interceptor"

	"github.com/pkg/errors"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/logging"
	pkg_utils "github.com/snyk/go-application-framework/pkg/utils"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/spf13/pflag"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/internal/proxy"
	cliv2utils "github.com/snyk/cli/cliv2/internal/utils"
)

var WORKFLOWID_LEGACY_CLI workflow.Identifier = workflow.NewWorkflowIdentifier("legacycli")
var DATATYPEID_LEGACY_CLI_STDOUT workflow.Identifier = workflow.NewTypeIdentifier(WORKFLOWID_LEGACY_CLI, "stdout")
var staticNodeJsBinary string // injected by Makefile

const (
	PROXY_NOAUTH string = "proxy-noauth"
)

func initLegacycli(engine workflow.Engine) error {
	flagset := pflag.NewFlagSet("legacycli", pflag.ContinueOnError)
	flagset.StringSlice(configuration.RAW_CMD_ARGS, os.Args[1:], "Command line arguments for the legacy CLI.")
	flagset.Bool(configuration.WORKFLOW_USE_STDIO, false, "Use StdIn and StdOut")
	flagset.String(configuration.WORKING_DIRECTORY, "", "CLI working directory")

	config := workflow.ConfigurationOptionsFromFlagset(flagset)
	entry, err := engine.Register(WORKFLOWID_LEGACY_CLI, config, legacycliWorkflow)
	if err != nil {
		return err
	}
	entry.SetVisibility(false)

	return nil
}

func finalizeArguments(args []string, unknownArgs []string) []string {
	// filter args not meant to be forwarded to CLIv1 or an Extensions
	elementsToFilter := []string{"--" + PROXY_NOAUTH}
	filteredArgs := args
	for _, element := range elementsToFilter {
		filteredArgs = pkg_utils.RemoveSimilar(filteredArgs, element)
	}

	if len(unknownArgs) > 0 && !pkg_utils.Contains(args, "--") {
		filteredArgs = append(filteredArgs, "--")
		filteredArgs = append(filteredArgs, unknownArgs...)
	}

	return filteredArgs
}

func legacycliWorkflow(
	invocation workflow.InvocationContext,
	_ []workflow.Data,
) (output []workflow.Data, err error) {
	output = []workflow.Data{}
	var outBuffer bytes.Buffer
	var outWriter *bufio.Writer
	var errWriter *bufio.Writer

	config := invocation.GetConfiguration()
	debugLogger := invocation.GetEnhancedLogger() // uses zerolog
	debugLoggerDefault := invocation.GetLogger()  // uses log
	ri := invocation.GetRuntimeInfo()

	args := config.GetStringSlice(configuration.RAW_CMD_ARGS)
	useStdIo := config.GetBool(configuration.WORKFLOW_USE_STDIO)
	workingDirectory := config.GetString(configuration.WORKING_DIRECTORY)
	analyticsDisabled := config.GetBool(configuration.ANALYTICS_DISABLED)

	debugLogger.Print("Use StdIO:", useStdIo)
	debugLogger.Print("Working directory:", workingDirectory)

	// init cli object
	var cli *cliv2.CLI
	cli, err = cliv2.NewCLIv2(config, debugLoggerDefault, ri)
	if err != nil {
		return output, err
	}

	cli.WorkingDirectory = workingDirectory

	// ensure to disable analytics based on configuration
	if _, exists := os.LookupEnv(constants.SNYK_ANALYTICS_DISABLED_ENV); !exists && analyticsDisabled {
		env := []string{constants.SNYK_ANALYTICS_DISABLED_ENV + "=1"}
		cli.AppendEnvironmentVariables(env)
	}

	// In general all authentication if handled through the Extensible CLI now. But there is some legacy logic
	// that checks for an API token to be available. Until this logic is safely removed, we will be injecting a
	// fake/random API token to bypass this logic.
	apiToken := config.GetString(configuration.AUTHENTICATION_TOKEN)
	if len(apiToken) == 0 {
		apiToken = "random"
	}
	cli.AppendEnvironmentVariables([]string{constants.SNYK_API_TOKEN_ENV + "=" + apiToken})

	err = cli.Init()
	if err != nil {
		return output, err
	}

	scrubDict := logging.GetScrubDictFromConfig(config)
	scrubbedStderr := logging.NewScrubbingIoWriter(os.Stderr, scrubDict)
	// catpure CLI arguments
	allArgs := cliv2utils.CaptureAllArgs(os.Args[1:])

	// create a list of all the primary/secondary flag values
	flagTerms := []string{}
	for _, term := range allArgs.PrimaryFlags {
		termString, ok := term.(string)
		if ok {
			flagTerms = append(flagTerms, termString)
		}
	}
	for _, term := range allArgs.SecondaryFlags {
		termString, ok := term.(string)
		if ok {
			flagTerms = append(flagTerms, termString)
		}
	}

	// iterate over allArgs and add the values to the scrub dict
	for _, term := range flagTerms {
		scrubbedStderr.(logging.ScrubbingLogWriter).AddTerm(term, 0)
	}

	if !useStdIo {
		in := bytes.NewReader([]byte{})
		outWriter = bufio.NewWriter(&outBuffer)
		errWriter = bufio.NewWriter(scrubbedStderr)
		cli.SetIoStreams(in, outWriter, errWriter)
	} else {
		cli.SetIoStreams(os.Stdin, os.Stdout, scrubbedStderr)
	}

	wrapperProxy, err := createInternalProxy(
		config,
		debugLogger,
		invocation,
	)
	if err != nil {
		return output, err
	}

	// run the cli
	proxyInfo := wrapperProxy.ProxyInfo()
	err = cli.Execute(proxyInfo, finalizeArguments(args, config.GetStringSlice(configuration.UNKNOWN_ARGS)))

	if !useStdIo {
		outWriter.Flush()
		errWriter.Flush()

		contentType := "text/plain"
		if pkg_utils.Contains(args, "--json") || pkg_utils.Contains(args, "--sarif") {
			contentType = "application/json"
		}

		data := workflow.NewData(DATATYPEID_LEGACY_CLI_STDOUT, contentType, outBuffer.Bytes())
		output = append(output, data)
	}

	var exitError *exec.ExitError
	if errors.As(err, &exitError) {
		invocation.GetAnalytics().AddExtensionIntegerValue("exitcode", exitError.ExitCode())
	}

	staticNodeJsBinaryBool, parseErr := strconv.ParseBool(staticNodeJsBinary)
	if parseErr != nil {
		debugLogger.Print("Failed to parse staticNodeJsBinary:", parseErr)
	}
	invocation.GetAnalytics().AddExtensionBoolValue("static-nodejs-binary", staticNodeJsBinaryBool)

	return output, err
}

func createInternalProxy(config configuration.Configuration, debugLogger *zerolog.Logger, invocation workflow.InvocationContext) (*proxy.WrapperProxy, error) {
	caData, err := GetGlobalCertAuthority(config, debugLogger)
	if err != nil {
		return nil, err
	}

	wrapperProxy, err := proxy.NewWrapperProxy(config, cliv2.GetFullVersion(), debugLogger, caData)
	if err != nil {
		return nil, errors.Wrap(err, "Failed to create proxy!")
	}

	wrapperProxy.RegisterInterceptor(interceptor.NewV1AnalyticsInterceptor(invocation))
	// The networkinjector intercepts all requests from the legacy CLI and re-routes them to the existing networking
	// layer. It should therefore be kept as the last interceptor in the chain, as it circuit breaks goproxy's own
	// routing. Any interceptor added later will not be called.
	wrapperProxy.RegisterInterceptor(interceptor.NewNetworkInjector(invocation))

	err = wrapperProxy.Start()
	if err != nil {
		return nil, errors.Wrap(err, "Failed to start the proxy!")
	}

	return wrapperProxy, nil
}
