package main

import (
	"fmt"
	"io/ioutil"
	"log"
	"os"
	"snyk/cling/internal/cliv2"
	"snyk/cling/internal/proxy"
	"snyk/cling/internal/utils"
	"strings"
)

func getDebugLogger(args []string) *log.Logger {
	debugLogger := log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)
	debug := utils.Contains(args, "--debug")

	if !debug {
		debugLogger.SetOutput(ioutil.Discard)
	}

	return debugLogger
}

func main() {
	errorCode := mainWithErrorCode()
	os.Exit(errorCode)
}

func mainWithErrorCode() int {
	var err error

	// Read input from command line parameter and environment variables
	args := os.Args[1:]

	debugLogger := getDebugLogger(args)
	debugLogger.Println("debug: true")

	upstreamProxy := os.Getenv("HTTPS_PROXY")
	debugLogger.Println("upstreamProxy:", upstreamProxy)

	snykDNSNamesStr := os.Getenv("SNYK_DNS_NAMES")
	var snykDNSNames []string
	debugLogger.Println("SNYK_DNS_NAMES:", snykDNSNamesStr)
	if snykDNSNamesStr != "" {
		snykDNSNames = strings.Split(snykDNSNamesStr, ",")
	} else {
		snykDNSNames = []string{"snyk.io", "*.snyk.io"}
	}
	debugLogger.Println("snykDNSNames:", snykDNSNames)

	cacheDirectory := os.Getenv("SNYK_CACHE_PATH")
	if cacheDirectory == "" {
		cacheDirectory, err = utils.SnykCacheDir()
		if err != nil {
			fmt.Println("Failed to determine cache directory!")
			fmt.Println(err)
			return cliv2.SNYK_EXIT_CODE_ERROR
		}
	}
	debugLogger.Println("cacheDirectory:", cacheDirectory)

	// init cli object
	var cli *cliv2.CLI
	cli = cliv2.NewCLIv2(cacheDirectory, debugLogger)
	if cli == nil {
		return cliv2.SNYK_EXIT_CODE_ERROR
	}

	// init proxy object
	wrapperProxy, err := proxy.NewWrapperProxy(upstreamProxy, snykDNSNames, cacheDirectory, debugLogger)
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
