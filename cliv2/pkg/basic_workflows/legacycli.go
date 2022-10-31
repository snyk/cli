package basic_workflows

import (
	"io/ioutil"
	"log"
	"net/http"
	"os"

	"github.com/pkg/errors"
	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/proxy"
	"github.com/snyk/cli/cliv2/internal/utils"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/workflow"
	"github.com/snyk/go-httpauth/pkg/httpauth"
	"github.com/spf13/pflag"
)

var WORKFLOWID_LEGACY_CLI workflow.Identifier = workflow.NewWorkflowIdentifier("legacycli")

const (
	PROXY_NOAUTH string = "proxy-noauth"
)

func Init(engine workflow.Engine) error {
	flagset := pflag.NewFlagSet("legacycli", pflag.ContinueOnError)
	config := workflow.ConfigurationOptionsFromFlagset(flagset)
	entry, _ := engine.Register(WORKFLOWID_LEGACY_CLI, config, legacycliWorkflow)
	entry.SetVisibility(false)
	return nil
}

func FilteredArgs() []string {
	// filter args not meant to be forwarded to CLIv1 or an Extensions
	args := os.Args[1:]
	elementsToFilter := []string{"--" + PROXY_NOAUTH}
	filteredArgs := args
	for _, element := range elementsToFilter {
		filteredArgs = utils.RemoveSimilar(filteredArgs, element)
	}
	return filteredArgs
}

func legacycliWorkflow(invocation workflow.InvocationContext, input []workflow.Data) (output []workflow.Data, err error) {
	output = []workflow.Data{}

	config := invocation.GetConfiguration()
	debugLogger := log.Default()

	useStdIo := config.GetBool(configuration.WORKFLOW_USE_STDIO)
	debug := config.GetBool(configuration.DEBUG)
	cacheDirectory := config.GetString(configuration.CACHE_PATH)
	insecure := config.GetBool(configuration.INSECURE_HTTPS)
	proxyAuthenticationMechanismString := config.GetString(configuration.PROXY_AUTHENTICATION_MECHANISM)
	proxyAuthenticationMechanism := httpauth.AuthenticationMechanismFromString(proxyAuthenticationMechanismString)

	if !debug {
		debugLogger.SetOutput(ioutil.Discard)
	}

	debugLogger.Println("Cache directory:", cacheDirectory)
	debugLogger.Println("Insecure:", insecure)
	debugLogger.Println("Use StdIO:", useStdIo)

	if cacheDirectory == "" {
		cacheDirectory, err = utils.SnykCacheDir()
		if err != nil {
			return output, errors.Wrap(err, "Failed to determine cache directory!")
		}
	}

	// init cli object
	var cli *cliv2.CLI
	cli, err = cliv2.NewCLIv2(cacheDirectory, debugLogger)
	if err != nil {
		return output, err
	}

	// init proxy object
	wrapperProxy, err := proxy.NewWrapperProxy(insecure, cacheDirectory, cliv2.GetFullVersion(), debugLogger)
	defer wrapperProxy.Close()
	if err != nil {
		return output, errors.Wrap(err, "Failed to create proxy!")
	}

	wrapperProxy.SetUpstreamProxyAuthentication(proxyAuthenticationMechanism)
	http.DefaultTransport = wrapperProxy.Transport()

	err = wrapperProxy.Start()
	if err != nil {
		return output, errors.Wrap(err, "Failed to start the proxy!")
	}

	// run the cli
	proxyInfo := wrapperProxy.ProxyInfo()
	err = cli.Execute(proxyInfo, FilteredArgs())

	return output, err
}
