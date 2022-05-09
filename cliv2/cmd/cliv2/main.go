package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"

	"github.com/snyk/cli/cliv2/internal/cliv2"
	"github.com/snyk/cli/cliv2/internal/proxy"
	"github.com/snyk/cli/cliv2/internal/utils"
)

type EnvironmentVariables struct {
	CacheDirectory string
}

func getDebugLogger(args []string) *log.Logger {
	debugLogger := log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)
	debug := utils.Contains(args, "--debug")

	if !debug {
		debugLogger.SetOutput(ioutil.Discard)
	}

	return debugLogger
}

func main() {
	envVariables := EnvironmentVariables{
		CacheDirectory: os.Getenv("SNYK_CACHE_PATH"),
	}
	errorCode := MainWithErrorCode(envVariables, os.Args[1:])
	os.Exit(errorCode)
}

func MainWithErrorCode(envVariables EnvironmentVariables, args []string) int {
	var err error
	debugLogger := getDebugLogger(args)
	debugLogger.Println("debug: true")

	debugLogger.Println("cacheDirectory:", envVariables.CacheDirectory)

	insecure := utils.Contains(args, "--insecure")
	debugLogger.Println("insecure:", insecure)

	if envVariables.CacheDirectory == "" {
		envVariables.CacheDirectory, err = utils.SnykCacheDir()
		if err != nil {
			fmt.Println("Failed to determine cache directory!")
			fmt.Println(err)
			return cliv2.SNYK_EXIT_CODE_ERROR
		}
	}

	// init cli object
	var cli *cliv2.CLI
	cli = cliv2.NewCLIv2(envVariables.CacheDirectory, debugLogger)
	if cli == nil {
		return cliv2.SNYK_EXIT_CODE_ERROR
	}

	// init proxy object
	wrapperProxy, err := proxy.NewWrapperProxy(insecure, envVariables.CacheDirectory, cli.GetFullVersion(), debugLogger)
	if err != nil {
		fmt.Println("Failed to create proxy")
		fmt.Println(err)
		return cliv2.SNYK_EXIT_CODE_ERROR
	}

	port, err := wrapperProxy.Start()
	if err != nil {
		fmt.Println("Failed to start the proxy")
		fmt.Println(err)
		return cliv2.SNYK_EXIT_CODE_ERROR
	}

	// run the cli
	exitCode := cli.Execute(port, wrapperProxy.CertificateLocation, args)

	debugLogger.Println("in main, cliv1 is done")
	wrapperProxy.Close()
	debugLogger.Printf("Exiting with %d\n", exitCode)

	return exitCode
}
