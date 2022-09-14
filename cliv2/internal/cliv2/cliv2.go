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
	"strings"

	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/internal/embedded"
	"github.com/snyk/cli/cliv2/internal/embedded/cliv1"
	"github.com/snyk/cli/cliv2/internal/utils"
)

type Handler int

type CLI struct {
	DebugLogger      *log.Logger
	CacheDirectory   string
	v1BinaryLocation string
}

type EnvironmentWarning struct {
	message string
}

const (
	V1_DEFAULT Handler = iota
	V2_VERSION Handler = iota
	V2_ABOUT   Handler = iota
)

//go:embed cliv2.version
var version_prefix string

func NewCLIv2(cacheDirectory string, debugLogger *log.Logger) (*CLI, error) {

	v1BinaryLocation, err := cliv1.GetFullCLIV1TargetPath(cacheDirectory)
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	cli := CLI{
		DebugLogger:      debugLogger,
		CacheDirectory:   cacheDirectory,
		v1BinaryLocation: v1BinaryLocation,
	}

	err = cli.ExtractV1Binary()
	if err != nil {
		fmt.Println(err)
		return nil, err
	}

	return &cli, nil
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

func GetFullVersion() string {
	v1Version := cliv1.CLIV1Version()
	v2Version := strings.TrimSpace(version_prefix)

	if len(v2Version) > 0 {
		return v2Version + "." + v1Version
	} else {
		return v1Version
	}
}

func (c *CLI) GetIntegrationName() string {
	return constants.SNYK_INTEGRATION_NAME
}

func (c *CLI) GetBinaryLocation() string {
	return c.v1BinaryLocation
}

func (c *CLI) printVersion() {
	fmt.Println(GetFullVersion())
}

func (c *CLI) commandVersion(passthroughArgs []string) error {
	if utils.Contains(passthroughArgs, "--json-file-output") {
		return fmt.Errorf("The following option combination is not currently supported: version + json-file-output")
	} else {
		c.printVersion()
		return nil
	}
}

func (c *CLI) commandAbout(wrapperProxyPort int, fullPathToCert string, passthroughArgs []string) error {

	err := c.executeV1Default(wrapperProxyPort, fullPathToCert, passthroughArgs)
	if err != nil {
		return err
	}

	separator := "\n+-+-+-+-+-+-+\n\n"

	allEmbeddedFiles := embedded.ListFiles()
	for i := range allEmbeddedFiles {
		f := &allEmbeddedFiles[i]
		path := f.Path()

		if strings.Contains(path, "licenses") {
			size := f.Size()
			data := make([]byte, size)
			_, err := f.Read(data)
			if err != nil {
				continue
			}

			fmt.Printf("Package: %s \n", strings.ReplaceAll(strings.ReplaceAll(path, "/licenses/", ""), "/"+f.Name(), ""))
			fmt.Println(string(data))
			fmt.Println(separator)
		}
	}

	return nil
}

func determineHandler(passthroughArgs []string) Handler {
	result := V1_DEFAULT

	if utils.Contains(passthroughArgs, "--version") ||
		utils.Contains(passthroughArgs, "-v") ||
		utils.Contains(passthroughArgs, "version") {
		result = V2_VERSION
	} else if utils.Contains(passthroughArgs, "--about") {
		result = V2_ABOUT
	}

	return result
}

func PrepareV1EnvironmentVariables(input []string, integrationName string, integrationVersion string, proxyAddress string, caCertificateLocation string) (result []string, err error) {

	inputAsMap := utils.ToKeyValueMap(input, "=")
	result = input

	_, integrationNameExists := inputAsMap[constants.SNYK_INTEGRATION_NAME_ENV]
	_, integrationVersionExists := inputAsMap[constants.SNYK_INTEGRATION_VERSION_ENV]

	if !integrationNameExists && !integrationVersionExists {
		inputAsMap[constants.SNYK_INTEGRATION_NAME_ENV] = integrationName
		inputAsMap[constants.SNYK_INTEGRATION_VERSION_ENV] = integrationVersion
	} else if !(integrationNameExists && integrationVersionExists) {
		err = EnvironmentWarning{message: fmt.Sprintf("Partially defined environment, please ensure to provide both %s and %s together!", constants.SNYK_INTEGRATION_NAME_ENV, constants.SNYK_INTEGRATION_VERSION_ENV)}
	}

	if err == nil {

		// apply blacklist: ensure that no existing no_proxy or other configuration causes redirecting internal communication that is meant to stay between cliv1 and cliv2
		blackList := []string{
			constants.SNYK_HTTPS_PROXY_ENV,
			constants.SNYK_HTTP_PROXY_ENV,
			constants.SNYK_CA_CERTIFICATE_LOCATION_ENV,
			constants.SNYK_HTTP_NO_PROXY_ENV,
			constants.SNYK_NPM_NO_PROXY_ENV,
			constants.SNYK_NPM_HTTPS_PROXY_ENV,
			constants.SNYK_NPM_HTTP_PROXY_ENV,
			constants.SNYK_NPM_PROXY_ENV,
			constants.SNYK_NPM_ALL_PROXY,
		}

		for _, key := range blackList {
			inputAsMap = utils.Remove(inputAsMap, key)
		}

		// fill expected values
		inputAsMap[constants.SNYK_HTTPS_PROXY_ENV] = proxyAddress
		inputAsMap[constants.SNYK_HTTP_PROXY_ENV] = proxyAddress
		inputAsMap[constants.SNYK_CA_CERTIFICATE_LOCATION_ENV] = caCertificateLocation

		result = utils.ToSlice(inputAsMap, "=")
	}

	return result, err

}

func PrepareV1Command(cmd string, args []string, proxyPort int, caCertLocation string, integrationName string, integrationVersion string) (snykCmd *exec.Cmd, err error) {

	proxyAddress := fmt.Sprintf("http://127.0.0.1:%d", proxyPort)

	snykCmd = exec.Command(cmd, args...)
	snykCmd.Env, err = PrepareV1EnvironmentVariables(os.Environ(), integrationName, integrationVersion, proxyAddress, caCertLocation)
	snykCmd.Stdin = os.Stdin
	snykCmd.Stdout = os.Stdout
	snykCmd.Stderr = os.Stderr

	return snykCmd, err
}

func (c *CLI) executeV1Default(wrapperProxyPort int, fullPathToCert string, passthroughArgs []string) error {
	c.DebugLogger.Println("launching snyk with path: ", c.v1BinaryLocation)
	c.DebugLogger.Println("fullPathToCert:", fullPathToCert)

	snykCmd, err := PrepareV1Command(
		c.v1BinaryLocation,
		passthroughArgs,
		wrapperProxyPort,
		fullPathToCert,
		c.GetIntegrationName(),
		GetFullVersion(),
	)

	if err != nil {
		if evWarning, ok := err.(EnvironmentWarning); ok {
			fmt.Println("WARNING! ", evWarning)
		}
	}

	err = snykCmd.Run()

	return err
}

func (c *CLI) Execute(wrapperProxyPort int, fullPathToCert string, passthroughArgs []string) error {
	c.DebugLogger.Println("passthroughArgs", passthroughArgs)

	var err error
	handler := determineHandler(passthroughArgs)

	switch {
	case handler == V2_VERSION:
		err = c.commandVersion(passthroughArgs)
	case handler == V2_ABOUT:
		err = c.commandAbout(wrapperProxyPort, fullPathToCert, passthroughArgs)
	default:
		err = c.executeV1Default(wrapperProxyPort, fullPathToCert, passthroughArgs)
	}

	return err
}

func (c *CLI) DeriveExitCode(err error) int {
	returnCode := constants.SNYK_EXIT_CODE_OK

	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			returnCode = exitError.ExitCode()
		} else {
			// got an error but it's not an ExitError
			fmt.Println(err)
			returnCode = constants.SNYK_EXIT_CODE_ERROR
		}
	}

	return returnCode
}

func (e EnvironmentWarning) Error() string {
	return e.message
}
