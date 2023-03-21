package basic_workflows

import (
	"bufio"
	"bytes"
	"os"

	"github.com/pkg/errors"
	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/proxy"
	"github.com/snyk/go-application-framework/pkg/configuration"
	pkg_utils "github.com/snyk/go-application-framework/pkg/utils"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/snyk/go-httpauth/pkg/httpauth"
	"github.com/spf13/pflag"
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

func legacycliWorkflow(invocation workflow.InvocationContext, input []workflow.Data) (output []workflow.Data, err error) {
	output = []workflow.Data{}
	var outBuffer bytes.Buffer
	var errBuffer bytes.Buffer

	config := invocation.GetConfiguration()
	debugLogger := invocation.GetLogger()

	args := config.GetStringSlice(configuration.RAW_CMD_ARGS)
	useStdIo := config.GetBool(configuration.WORKFLOW_USE_STDIO)
	cacheDirectory := config.GetString(configuration.CACHE_PATH)
	insecure := config.GetBool(configuration.INSECURE_HTTPS)
	proxyAuthenticationMechanismString := config.GetString(configuration.PROXY_AUTHENTICATION_MECHANISM)
	proxyAuthenticationMechanism := httpauth.AuthenticationMechanismFromString(proxyAuthenticationMechanismString)

	debugLogger.Println("Arguments:", args)
	debugLogger.Println("Use StdIO:", useStdIo)

	// init cli object
	var cli *cliv2.CLI
	cli, err = cliv2.NewCLIv2(cacheDirectory, debugLogger)
	if err != nil {
		return output, err
	}

	err = cli.Init()
	if err != nil {
		return output, err
	}

	if useStdIo == false {
		in := bytes.NewReader([]byte{})
		out := bufio.NewWriter(&outBuffer)
		err := bufio.NewWriter(&errBuffer)
		cli.SetIoStreams(in, out, err)
	}

	// init proxy object
	wrapperProxy, err := proxy.NewWrapperProxy(insecure, cacheDirectory, cliv2.GetFullVersion(), debugLogger)
	if err != nil {
		return output, errors.Wrap(err, "Failed to create proxy!")
	}
	defer wrapperProxy.Close()

	wrapperProxy.SetUpstreamProxyAuthentication(proxyAuthenticationMechanism)

	err = wrapperProxy.Start()
	if err != nil {
		return output, errors.Wrap(err, "Failed to start the proxy!")
	}

	// run the cli
	proxyInfo := wrapperProxy.ProxyInfo()
	err = cli.Execute(proxyInfo, FilteredArgs(args))

	if useStdIo == false {
		data := workflow.NewData(DATATYPEID_LEGACY_CLI_STDOUT, "text/plain", outBuffer.Bytes())
		output = append(output, data)
	}

	return output, err
}
