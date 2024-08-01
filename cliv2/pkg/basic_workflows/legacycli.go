package basic_workflows

import (
	"bufio"
	"bytes"
	"net/http"
	"os"
	"sync"

	"github.com/pkg/errors"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/logging"
	pkg_utils "github.com/snyk/go-application-framework/pkg/utils"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/snyk/go-httpauth/pkg/httpauth"
	"github.com/spf13/pflag"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/internal/proxy"
)

var WORKFLOWID_LEGACY_CLI workflow.Identifier = workflow.NewWorkflowIdentifier("legacycli")
var DATATYPEID_LEGACY_CLI_STDOUT workflow.Identifier = workflow.NewTypeIdentifier(WORKFLOWID_LEGACY_CLI, "stdout")

var proxySingleton *proxy.WrapperProxy
var proxyMutex sync.Mutex

const (
	PROXY_NOAUTH string = "proxy-noauth"
)

func Init(engine workflow.Engine) error {
	flagset := pflag.NewFlagSet("legacycli", pflag.ContinueOnError)
	flagset.StringSlice(configuration.RAW_CMD_ARGS, os.Args[1:], "Command line arguments for the legacy CLI.")
	flagset.Bool(configuration.WORKFLOW_USE_STDIO, false, "Use StdIn and StdOut")
	flagset.String(configuration.WORKING_DIRECTORY, "", "CLI working directory")

	config := workflow.ConfigurationOptionsFromFlagset(flagset)
	entry, _ := engine.Register(WORKFLOWID_LEGACY_CLI, config, legacycliWorkflow)
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
	var errBuffer bytes.Buffer
	var outWriter *bufio.Writer
	var errWriter *bufio.Writer

	config := invocation.GetConfiguration()
	debugLogger := invocation.GetEnhancedLogger() // uses zerolog
	debugLoggerDefault := invocation.GetLogger()  // uses log

	oauthIsAvailable := config.GetBool(configuration.FF_OAUTH_AUTH_FLOW_ENABLED)
	args := config.GetStringSlice(configuration.RAW_CMD_ARGS)
	useStdIo := config.GetBool(configuration.WORKFLOW_USE_STDIO)
	isDebug := config.GetBool(configuration.DEBUG)
	workingDirectory := config.GetString(configuration.WORKING_DIRECTORY)
	proxyAuthenticationMechanismString := config.GetString(configuration.PROXY_AUTHENTICATION_MECHANISM)
	proxyAuthenticationMechanism := httpauth.AuthenticationMechanismFromString(proxyAuthenticationMechanismString)
	analyticsDisabled := config.GetBool(configuration.ANALYTICS_DISABLED)

	debugLogger.Print("Arguments:", args)
	debugLogger.Print("Use StdIO:", useStdIo)
	debugLogger.Print("Working directory:", workingDirectory)

	// init cli object
	var cli *cliv2.CLI
	cli, err = cliv2.NewCLIv2(config, debugLoggerDefault)
	if err != nil {
		return output, err
	}

	cli.WorkingDirectory = workingDirectory

	// ensure to disable analytics based on configuration
	if _, exists := os.LookupEnv(constants.SNYK_ANALYTICS_DISABLED_ENV); !exists && analyticsDisabled {
		env := []string{constants.SNYK_ANALYTICS_DISABLED_ENV + "=1"}
		cli.AppendEnvironmentVariables(env)
	}

	if oauthIsAvailable {
		// The Legacy CLI doesn't support oauth authentication. Oauth authentication is implemented in the Extensible CLI and is added
		// to the legacy CLI by forwarding network traffic through the internal proxy of the Extensible CLI.
		// The legacy CLI always expects some sort of token to be available, otherwise some functionality isn't available. This is why we inject
		// a random token value to bypass these checks and replace the proper authentication headers in the internal proxy.
		// Injecting the real token here and not in the proxy would create an issue when the token expires during CLI execution.
		if oauth := config.GetString(auth.CONFIG_KEY_OAUTH_TOKEN); len(oauth) > 0 {
			envMap := pkg_utils.ToKeyValueMap(os.Environ(), "=")
			if _, ok := envMap[constants.SNYK_OAUTH_ACCESS_TOKEN_ENV]; !ok {
				env := []string{constants.SNYK_OAUTH_ACCESS_TOKEN_ENV + "=randomtoken"}
				cli.AppendEnvironmentVariables(env)
				debugLogger.Print("Authentication: Oauth token handling delegated to Extensible CLI.")
			} else {
				debugLogger.Print("Authentication: Using oauth token from Environment Variable.")
			}
		}
	}

	err = cli.Init()
	if err != nil {
		return output, err
	}

	if !useStdIo {
		in := bytes.NewReader([]byte{})
		outWriter = bufio.NewWriter(&outBuffer)
		errWriter = bufio.NewWriter(&errBuffer)
		cli.SetIoStreams(in, outWriter, errWriter)
	} else {
		scrubDict := logging.GetScrubDictFromConfig(config)
		scrubbedStderr := logging.NewScrubbingIoWriter(os.Stderr, scrubDict)
		cli.SetIoStreams(os.Stdin, os.Stdout, scrubbedStderr)
	}

	wrapperProxy, err := getProxyInstance(config, debugLogger, proxyAuthenticationMechanism, invocation.GetEngine())
	if err != nil {
		return output, err
	}

	// run the cli
	proxyInfo := wrapperProxy.ProxyInfo()
	err = cli.Execute(proxyInfo, finalizeArguments(args, config.GetStringSlice(configuration.UNKNOWN_ARGS)))

	if !useStdIo {
		outWriter.Flush()
		errWriter.Flush()

		if isDebug {
			debugLogger.Print(errBuffer.String())
		}

		contentType := "text/plain"
		if pkg_utils.Contains(args, "--json") || pkg_utils.Contains(args, "--sarif") {
			contentType = "application/json"
		}

		data := workflow.NewData(DATATYPEID_LEGACY_CLI_STDOUT, contentType, outBuffer.Bytes())
		output = append(output, data)
	}

	return output, err
}

func Cleanup() {
	proxyMutex.Lock()
	defer proxyMutex.Unlock()
	if proxySingleton != nil {
		proxySingleton.Close()
		proxySingleton = nil
	}
}

func getProxyInstance(config configuration.Configuration, debugLogger *zerolog.Logger, proxyAuthenticationMechanism httpauth.AuthenticationMechanism, engine workflow.Engine) (*proxy.WrapperProxy, error) {
	proxyMutex.Lock()
	defer proxyMutex.Unlock()

	if proxySingleton == nil {
		// init proxy object
		tmp, err := proxy.NewWrapperProxy(config, cliv2.GetFullVersion(), debugLogger)
		if err != nil {
			return nil, errors.Wrap(err, "Failed to create proxy!")
		}

		tmp.SetUpstreamProxyAuthentication(proxyAuthenticationMechanism)

		proxyHeaderFunc := func(req *http.Request) error {
			headersErr := engine.GetNetworkAccess().AddHeaders(req)
			return headersErr
		}
		tmp.SetHeaderFunction(proxyHeaderFunc)

		err = tmp.Start()
		if err != nil {
			return nil, errors.Wrap(err, "Failed to start the proxy!")
		}

		proxySingleton = tmp
	}

	return proxySingleton, nil
}
