/*
Entry point class for the CLIv2 version.
*/
package cliv2

import (
	_ "embed"
	"fmt"
	"log"
	"os"
	"os/exec"
	"snyk/cling/internal/embedded"
	"snyk/cling/internal/embedded/cliv1"
	"snyk/cling/internal/utils"
	"strings"
)

type Handler int

type CLI struct {
	DebugLogger      *log.Logger
	CacheDirectory   string
	v1BinaryLocation string
	v1Version        string
	v2Version        string
}

const SNYK_EXIT_CODE_OK = 0
const SNYK_EXIT_CODE_ERROR = 2
const SNYK_INTEGRATION_NAME = "CLI_V1_PLUGIN"

const (
	V1_DEFAULT Handler = iota
	V2_VERSION Handler = iota
)

//go:embed cliv2.version
var SNYK_CLIV2_VERSION_PART string

func NewCLIv2(cacheDirectory string, debugLogger *log.Logger) *CLI {

	v1BinaryLocation, err := cliv1.GetFullCLIV1TargetPath(cacheDirectory)
	if err != nil {
		fmt.Println(err)
		return nil
	}

	cli := CLI{
		DebugLogger:      debugLogger,
		CacheDirectory:   cacheDirectory,
		v1Version:        cliv1.CLIV1Version(),
		v2Version:        SNYK_CLIV2_VERSION_PART,
		v1BinaryLocation: v1BinaryLocation,
	}

	err = cli.ExtractV1Binary()
	if err != nil {
		fmt.Println(err)
		return nil
	}

	return &cli
}

func (c *CLI) ExtractV1Binary() error {
	cliV1ExpectedSHA256 := cliv1.ExpectedSHA256()

	isValid, err := embedded.ValidateFile(c.v1BinaryLocation, cliV1ExpectedSHA256, c.DebugLogger)
	if err != nil || !isValid {
		c.DebugLogger.Println("cliv1 is not valid, start extracting ", c.v1BinaryLocation)

		err = cliv1.ExtractTo(c.v1BinaryLocation)
		if err != nil {
			return err
		}

		isValid, err := embedded.ValidateFile(c.v1BinaryLocation, cliV1ExpectedSHA256, c.DebugLogger)
		if err != nil {
			return err
		}

		if isValid {
			c.DebugLogger.Println("cliv1 is valid after extracting", c.v1BinaryLocation)
		} else {
			fmt.Println("cliv1 is not valid after sha256 check")
			return err
		}
	} else {
		c.DebugLogger.Println("cliv1 already exists and is valid at", c.v1BinaryLocation)
	}

	return nil
}

func (c *CLI) GetFullVersion() string {
	return strings.TrimSpace(c.v2Version) + "+" + strings.Replace(c.v1Version, "v", "", 1)
}

func (c *CLI) GetIntegrationName() string {
	return SNYK_INTEGRATION_NAME
}

func (c *CLI) printVersion() {
	fmt.Println(c.GetFullVersion())
}

func determineHandler(passthroughArgs []string) Handler {
	result := V1_DEFAULT

	if utils.Contains(passthroughArgs, "--version") ||
		utils.Contains(passthroughArgs, "-v") ||
		utils.Contains(passthroughArgs, "version") {
		result = V2_VERSION
	}

	return result
}

func (c *CLI) executeV1Default(wrapperProxyPort int, fullPathToCert string, passthroughArgs []string) int {
	c.DebugLogger.Println("launching snyk with path: ", c.v1BinaryLocation)
	c.DebugLogger.Println("fullPathToCert:", fullPathToCert)

	snykCmd := exec.Command(c.v1BinaryLocation, passthroughArgs...)
	snykCmd.Env = append(os.Environ(),
		fmt.Sprintf("HTTPS_PROXY=http://127.0.0.1:%d", wrapperProxyPort),
		fmt.Sprintf("NODE_EXTRA_CA_CERTS=%s", fullPathToCert),
		fmt.Sprintf("SNYK_INTEGRATION_VERSION=%s", c.GetFullVersion()),
		fmt.Sprintf("SNYK_INTEGRATION_NAME=%s", c.GetIntegrationName()),
	)

	snykCmd.Stdin = os.Stdin
	snykCmd.Stdout = os.Stdout
	snykCmd.Stderr = os.Stderr

	err := snykCmd.Run()
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode := exitError.ExitCode()
			return exitCode
		} else {
			// got an error but it's not an ExitError
			fmt.Println(err)
			return SNYK_EXIT_CODE_ERROR
		}
	}

	return SNYK_EXIT_CODE_OK
}

func (c *CLI) Execute(wrapperProxyPort int, fullPathToCert string, passthroughArgs []string) int {
	c.DebugLogger.Println("passthroughArgs", passthroughArgs)

	returnCode := SNYK_EXIT_CODE_OK
	handler := determineHandler(passthroughArgs)

	switch {
	case handler == V2_VERSION:
		c.printVersion()
	default:
		returnCode = c.executeV1Default(wrapperProxyPort, fullPathToCert, passthroughArgs)
	}

	return returnCode
}
