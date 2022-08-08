package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/exit_codes"
	"github.com/snyk/cli/cliv2/internal/extension"
	"github.com/snyk/cli/cliv2/internal/httpauth"
	"github.com/snyk/cli/cliv2/internal/proxy"
	"github.com/snyk/cli/cliv2/internal/utils"
)

type EnvironmentVariables struct {
	CacheDirectory               string
	Insecure                     bool
	ProxyAuthenticationMechanism httpauth.AuthenticationMechanism
	ProxyAddr                    string
}

func getDebugLogger(debug bool) *log.Logger {
	debugLogger := log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)

	if !debug {
		debugLogger.SetOutput(ioutil.Discard)
	}

	return debugLogger
}

func GetConfiguration(args []string) (EnvironmentVariables, []string) {
	argsAsMap := utils.ToKeyValueMap(args, "=")

	envVariables := EnvironmentVariables{
		CacheDirectory:               os.Getenv("SNYK_CACHE_PATH"),
		ProxyAuthenticationMechanism: httpauth.AnyAuth,
		Insecure:                     false,
	}

	if utils.Contains(args, "--proxy-noauth") {
		envVariables.ProxyAuthenticationMechanism = httpauth.NoAuth
	}

	envVariables.Insecure = utils.Contains(args, "--insecure")

	envVariables.ProxyAddr, _ = argsAsMap["--proxy"]

	// filter args not meant to be forwarded to CLIv1 or an Extensions
	elementsToFilter := []string{"--proxy=", "--proxy-noauth"}
	filteredArgs := args
	for _, element := range elementsToFilter {
		filteredArgs = utils.RemoveSimilar(filteredArgs, element)
	}

	return envVariables, filteredArgs
}

func debugArgPresent(args []string) bool {
	return utils.Contains(args, "--debug") || utils.Contains(args, "-d")
}

func main() {
	config, args := GetConfiguration(os.Args[1:])
	errorCode := MainWithErrorCode(config, args)
	os.Exit(errorCode)
}

func MainWithErrorCode(envVariables EnvironmentVariables, args []string) int {
	debugMode := debugArgPresent(args)

	var err error
	debugLogger := getDebugLogger(debugMode)
	debugLogger.Println("debug: true")

	debugLogger.Println("cacheDirectory:", envVariables.CacheDirectory)
	debugLogger.Println("insecure:", envVariables.Insecure)

	if envVariables.CacheDirectory == "" {
		envVariables.CacheDirectory, err = utils.SnykCacheDir()
		if err != nil {
			fmt.Println("Failed to determine cache directory!")
			fmt.Println(err)
			return exit_codes.SNYK_EXIT_CODE_ERROR
		}
	}

	extMngr := extension.New(&extension.Configuration{
		CacheDirectory: envVariables.CacheDirectory,
		Logger:         debugLogger,
	})

	err = extMngr.Init()
	if err != nil {
		fmt.Println(err)
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}

	// load extensions
	extensions := extMngr.AvailableExtenions()

	// build arg parser
	argParserRootCmd := cliv2.MakeArgParserConfig(extensions, debugLogger)

	// parse the input args
	debugLogger.Println("calling .Execute()...")
	argParserRootCmd.Execute()
	debugLogger.Println("back from .Execute()")
	if err != nil {
		fmt.Println(err)
		os.Exit(2)
	}

	// init cli object
	cli := cliv2.NewCLIv2(envVariables.CacheDirectory, extensions, argParserRootCmd, debugMode, debugLogger)
	if cli == nil {
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}

	// init proxy object
	wrapperProxy, err := proxy.NewWrapperProxy(envVariables.Insecure, envVariables.CacheDirectory, cli.GetFullVersion(), debugLogger)
	if err != nil {
		fmt.Println("Failed to create proxy")
		fmt.Println(err)
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}

	wrapperProxy.SetUpstreamProxyFromUrl(envVariables.ProxyAddr)
	wrapperProxy.SetUpstreamProxyAuthentication(envVariables.ProxyAuthenticationMechanism)

	port, err := wrapperProxy.Start()
	if err != nil {
		fmt.Println("Failed to start the proxy")
		fmt.Println(err)
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}

	// run the cli
	exitCode := cli.Execute(port, wrapperProxy.CertificateLocation, args)

	debugLogger.Println("in main, cliv1 is done")
	wrapperProxy.Close()
	debugLogger.Printf("Exiting with %d\n", exitCode)

	return exitCode
}
