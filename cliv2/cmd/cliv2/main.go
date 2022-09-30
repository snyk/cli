package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"os"

	"github.com/snyk/cli/cliv2/internal/analytics"
	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/configuration"
	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/internal/proxy"
	"github.com/snyk/cli/cliv2/internal/utils"
	"github.com/snyk/go-httpauth/pkg/httpauth"
)

type EnvironmentVariables struct {
	CacheDirectory               string
	Insecure                     bool
	ProxyAuthenticationMechanism httpauth.AuthenticationMechanism
}

func getDebugLogger(args []string) *log.Logger {
	debugLogger := log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)
	debug := utils.Contains(args, "--debug")

	if !debug {
		debug = utils.Contains(args, "-d")
	}

	if !debug {
		debugLogger.SetOutput(ioutil.Discard)
	}

	return debugLogger
}

func GetConfiguration(args []string) (EnvironmentVariables, []string) {
	envVariables := EnvironmentVariables{
		CacheDirectory:               os.Getenv("SNYK_CACHE_PATH"),
		ProxyAuthenticationMechanism: httpauth.AnyAuth,
		Insecure:                     false,
	}

	if utils.Contains(args, "--proxy-noauth") {
		envVariables.ProxyAuthenticationMechanism = httpauth.NoAuth
	}

	envVariables.Insecure = utils.Contains(args, "--insecure")

	// filter args not meant to be forwarded to CLIv1 or an Extensions
	elementsToFilter := []string{"--proxy-noauth"}
	filteredArgs := args
	for _, element := range elementsToFilter {
		filteredArgs = utils.RemoveSimilar(filteredArgs, element)
	}

	return envVariables, filteredArgs
}

func main() {
	config, args := GetConfiguration(os.Args[1:])
	errorCode := MainWithErrorCode(config, args)
	os.Exit(errorCode)
}

func initAnalytics(args []string, config configuration.Configuration) *analytics.Analytics {

	headerFunc := func() http.Header {
		h := http.Header{}

		authHeader := utils.GetAuthHeader(config)
		if len(authHeader) > 0 {
			h.Add("Authorization", authHeader)
		}

		h.Add("x-snyk-cli-version", cliv2.GetFullVersion())
		return h
	}

	cliAnalytics := analytics.New()
	cliAnalytics.SetVersion(cliv2.GetFullVersion())
	cliAnalytics.SetCmdArguments(args)
	cliAnalytics.SetIntegration(config.GetString(configuration.INTEGRATION_NAME), config.GetString(configuration.INTEGRATION_VERSION))
	cliAnalytics.SetApiUrl(config.GetString(configuration.API_URL))
	cliAnalytics.AddHeader(headerFunc)

	mappedArguments := utils.ToKeyValueMap(args, "=")
	if org, ok := mappedArguments["--org"]; ok {
		cliAnalytics.SetOrg(org)
	}

	return cliAnalytics
}

func MainWithErrorCode(envVariables EnvironmentVariables, args []string) int {
	var err error
	config := configuration.New()

	cliAnalytics := initAnalytics(args, config)
	if config.GetBool(configuration.ANALYTICS_DISABLED) == false {
		defer cliAnalytics.Send()
	}

	debugLogger := getDebugLogger(args)
	debugLogger.Println("debug: true")

	debugLogger.Println("cacheDirectory:", envVariables.CacheDirectory)
	debugLogger.Println("insecure:", envVariables.Insecure)

	if envVariables.CacheDirectory == "" {
		envVariables.CacheDirectory, err = utils.SnykCacheDir()
		if err != nil {
			fmt.Println("Failed to determine cache directory!")
			fmt.Println(err)
			return constants.SNYK_EXIT_CODE_ERROR
		}
	}

	// init cli object
	var cli *cliv2.CLI
	cli, err = cliv2.NewCLIv2(envVariables.CacheDirectory, debugLogger)
	if err != nil {
		cliAnalytics.AddError(err)
		return constants.SNYK_EXIT_CODE_ERROR
	}

	// init proxy object
	wrapperProxy, err := proxy.NewWrapperProxy(envVariables.Insecure, envVariables.CacheDirectory, cliv2.GetFullVersion(), debugLogger)
	defer wrapperProxy.Close()
	if err != nil {
		fmt.Println("Failed to create proxy")
		fmt.Println(err)
		cliAnalytics.AddError(err)
		return constants.SNYK_EXIT_CODE_ERROR
	}

	wrapperProxy.SetUpstreamProxyAuthentication(envVariables.ProxyAuthenticationMechanism)
	http.DefaultTransport = wrapperProxy.Transport()

	port, err := wrapperProxy.Start()
	if err != nil {
		fmt.Println("Failed to start the proxy")
		fmt.Println(err)
		cliAnalytics.AddError(err)
		return constants.SNYK_EXIT_CODE_ERROR
	}

	// run the cli
	err = cli.Execute(port, wrapperProxy.CertificateLocation, args)
	if err != nil {
		cliAnalytics.AddError(err)
	}

	exitCode := cli.DeriveExitCode(err)

	debugLogger.Printf("Exiting with %d\n", exitCode)

	return exitCode
}
