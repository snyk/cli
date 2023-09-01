package basic_workflows

import (
	"bufio"
	"bytes"
	"net/http"
	"os"

	"github.com/pkg/errors"
	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
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

func FilteredArgs(args []string) []string {
	// filter args not meant to be forwarded to CLIv1 or an Extensions
	elementsToFilter := []string{"--" + PROXY_NOAUTH}
	filteredArgs := args
	for _, element := range elementsToFilter {
		filteredArgs = pkg_utils.RemoveSimilar(filteredArgs, element)
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
	debugLogger := invocation.GetLogger()
	networkAccess := invocation.GetNetworkAccess()

	oauthIsAvailable := config.GetBool(configuration.FF_OAUTH_AUTH_FLOW_ENABLED)
	args := config.GetStringSlice(configuration.RAW_CMD_ARGS)
	useStdIo := config.GetBool(configuration.WORKFLOW_USE_STDIO)
	isDebug := config.GetBool(configuration.DEBUG)
	cacheDirectory := config.GetString(configuration.CACHE_PATH)
	workingDirectory := config.GetString(configuration.WORKING_DIRECTORY)
	insecure := config.GetBool(configuration.INSECURE_HTTPS)
	proxyAuthenticationMechanismString := config.GetString(configuration.PROXY_AUTHENTICATION_MECHANISM)
	proxyAuthenticationMechanism := httpauth.AuthenticationMechanismFromString(proxyAuthenticationMechanismString)
	analyticsDisabled := config.GetBool(configuration.ANALYTICS_DISABLED)

	debugLogger.Println("Arguments:", args)
	debugLogger.Println("Use StdIO:", useStdIo)
	debugLogger.Println("Working directory:", workingDirectory)

	// init cli object
	var cli *cliv2.CLI
	cli, err = cliv2.NewCLIv2(cacheDirectory, debugLogger)
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
				debugLogger.Println("Authentication: Oauth token handling delegated to Extensible CLI.")
			} else {
				debugLogger.Println("Authentication: Using oauth token from Environment Variable.")
			}
		}
	}

	err = cli.Init()
	if err != nil {
		return output, err
	}

	if useStdIo == false {
		in := bytes.NewReader([]byte{})
		outWriter = bufio.NewWriter(&outBuffer)
		errWriter = bufio.NewWriter(&errBuffer)
		cli.SetIoStreams(in, outWriter, errWriter)
	}

	// init proxy object
	wrapperProxy, err := proxy.NewWrapperProxy(insecure, cacheDirectory, cliv2.GetFullVersion(), debugLogger)
	if err != nil {
		return output, errors.Wrap(err, "Failed to create proxy!")
	}
	defer wrapperProxy.Close()

	wrapperProxy.SetUpstreamProxyAuthentication(proxyAuthenticationMechanism)

	proxyHeaderFunc := func(req *http.Request) error {
		err := networkAccess.AddHeaders(req)
		return err
	}
	wrapperProxy.SetHeaderFunction(proxyHeaderFunc)

	err = wrapperProxy.Start()
	if err != nil {
		return output, errors.Wrap(err, "Failed to start the proxy!")
	}

	// run the cli
	proxyInfo := wrapperProxy.ProxyInfo()
	err = cli.Execute(proxyInfo, FilteredArgs(args))

	if !useStdIo {
		outWriter.Flush()
		errWriter.Flush()

		if isDebug {
			debugLogger.Println(errBuffer.String())
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
