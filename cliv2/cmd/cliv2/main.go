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

func getDebugLogger(debug bool) *log.Logger {
	debugLogger := log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)

	if !debug {
		debugLogger.SetOutput(ioutil.Discard)
	}

	return debugLogger
}

func GetConfiguration(args []string) *cliv2.CliConfiguration {
	cliConfig := cliv2.CliConfiguration{
		CacheDirectory:               os.Getenv("SNYK_CACHE_PATH"),
		ProxyAuthenticationMechanism: httpauth.AnyAuth,
		Insecure:                     false,
		Debug:                        debugArgPresent(args), // parsing the debug flag here, enables to debug early before any cmd line argument parser is being run
	}

	return &cliConfig
}

func debugArgPresent(args []string) bool {
	return utils.Contains(args, "--debug") || utils.Contains(args, "-d")
}

func main() {
	args := os.Args[1:]
	config := GetConfiguration(args)
	errorCode := MainWithErrorCode(config, args)
	os.Exit(errorCode)
}

func MainWithErrorCode(cliConfig *cliv2.CliConfiguration, args []string) int {
	var err error
	cliConfig.DebugLogger = getDebugLogger(cliConfig.Debug)
	cliConfig.DebugLogger.Println("debug: true")

	if cliConfig.CacheDirectory == "" {
		cliConfig.CacheDirectory, err = utils.SnykCacheDir()
		if err != nil {
			fmt.Println("Failed to determine cache directory!")
			fmt.Println(err)
			return exit_codes.SNYK_EXIT_CODE_ERROR
		}
	}

	extMngr := extension.New(&extension.Configuration{
		CacheDirectory: cliConfig.CacheDirectory,
		Logger:         cliConfig.DebugLogger,
	})

	err = extMngr.Init()
	if err != nil {
		fmt.Println(err)
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}

	// load extensions
	extensions := extMngr.AvailableExtenions()

	// build arg parser
	argParserRootCmd := cliv2.MakeArgParserConfig(extensions, cliConfig)

	// parse the input args
	err = cliv2.ExecuteArgumentParser(argParserRootCmd, cliConfig)
	cliConfig.Log()
	if err != nil {
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}

	// check if it there's no command to run (in which case help will run automatically and we can just exit)
	matchedCommand, _, err := argParserRootCmd.Find(args)
	if err != nil {
		fmt.Println(err)
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}
	if matchedCommand == nil {
		fmt.Println("No command specified") // this should never happen
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}
	if matchedCommand.Name() == "help" && matchedCommand.Parent().Name() == "snyk" {
		// this is the root command, so we can just exit and the usage (help) will show automatically
		return exit_codes.SNYK_EXIT_CODE_OK
	}

	if matchedCommand.Name() == "snyk" {
		versionValue, err := matchedCommand.Flags().GetBool("version")
		if err != nil {
			fmt.Println(err)
			return exit_codes.SNYK_EXIT_CODE_ERROR
		}

		helpValue, err := matchedCommand.Flags().GetBool("help")
		if err != nil {
			fmt.Println(err)
			return exit_codes.SNYK_EXIT_CODE_ERROR
		}

		// if no version or help options set; show usage
		if !versionValue && !helpValue {
			matchedCommand.Usage()
			return exit_codes.SNYK_EXIT_CODE_OK
		}

		if helpValue {
			// usage is shown automatically
			return exit_codes.SNYK_EXIT_CODE_OK
		}

		if versionValue {
			cliConfig.DebugLogger.Println("version flag on root snyk command is set")
			// allow this to go through - don't return an error
		}
	}

	// init cli object
	cli := cliv2.NewCLIv2(cliConfig, extensions, argParserRootCmd)
	if cli == nil {
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}

	// init proxy object
	wrapperProxy, err := proxy.NewWrapperProxy(cliConfig.Insecure, cliConfig.CacheDirectory, cli.GetFullVersion(), cliConfig.DebugLogger)
	if err != nil {
		fmt.Println("Failed to create proxy")
		fmt.Println(err)
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}

	wrapperProxy.SetUpstreamProxyFromUrl(cliConfig.ProxyAddr)
	wrapperProxy.SetUpstreamProxyAuthentication(cliConfig.ProxyAuthenticationMechanism)

	port, err := wrapperProxy.Start()
	if err != nil {
		fmt.Println("Failed to start the proxy")
		fmt.Println(err)
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}

	// run the cli
	exitCode := cli.Execute(port, wrapperProxy.CertificateLocation, args)

	cliConfig.DebugLogger.Println("in main, cliv1 is done")
	wrapperProxy.Close()
	cliConfig.DebugLogger.Printf("Exiting with %d\n", exitCode)

	return exitCode
}
