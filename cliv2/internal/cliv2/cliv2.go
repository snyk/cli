/*
Entry point class for the CLIv2 version.
*/
package cliv2

import (
	_ "embed"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path"
	"regexp"
	"strings"

	"github.com/gofrs/flock"
	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/internal/embedded"
	"github.com/snyk/cli/cliv2/internal/embedded/cliv1"
	"github.com/snyk/cli/cliv2/internal/proxy"
	local_utils "github.com/snyk/cli/cliv2/internal/utils"
	"github.com/snyk/go-application-framework/pkg/utils"
)

type Handler int

type CLI struct {
	DebugLogger      *log.Logger
	CacheDirectory   string
	v1BinaryLocation string
	stdin            io.Reader
	stdout           io.Writer
	stderr           io.Writer
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
		stdin:            os.Stdin,
		stdout:           os.Stdout,
		stderr:           os.Stderr,
	}

	return &cli, nil
}

func (c *CLI) Init() (err error) {
	c.DebugLogger.Println("Init start")

	// ensure the specified base cache directory exists, this needs to be done even before acquiring the lock
	if _, err = os.Stat(c.CacheDirectory); os.IsNotExist(err) {
		err = os.Mkdir(c.CacheDirectory, local_utils.CACHEDIR_PERMISSION)
		if err != nil {
			return err
		}
	}

	// use filelock to synchronize parallel executed processes
	lockFileName := path.Join(c.CacheDirectory, GetFullVersion()+".lock")
	fileLock := flock.New(lockFileName)
	err = fileLock.Lock()
	if err != nil {
		return err
	}

	unlock := func() {
		fileLock.Unlock()
		os.Remove(lockFileName)
	}
	defer unlock()

	c.DebugLogger.Printf("Init-Lock acquired: %v (%s)\n", fileLock.Locked(), lockFileName)

	// create required cache and temp directories
	err = local_utils.CreateAllDirectories(c.CacheDirectory, GetFullVersion())
	if err != nil {
		return err
	}

	// cleanup cache a bit
	c.ClearCache()

	// extract cliv1
	err = c.ExtractV1Binary()
	if err != nil {
		return err
	}

	c.DebugLogger.Println("Init end")

	return err
}

func (c *CLI) ClearCache() error {
	// Get files in directory
	fileInfo, err := os.ReadDir(c.CacheDirectory)
	if err != nil {
		return err
	}

	// Get current version binary's path
	v1BinaryPath := path.Dir(c.v1BinaryLocation)
	var maxVersionToDelete = 5
	var deleteCount = 0
	for _, file := range fileInfo {
		currentPath := path.Join(c.CacheDirectory, file.Name())
		if currentPath != v1BinaryPath && !strings.Contains(currentPath, ".lock") {
			deleteCount++
			err = os.RemoveAll(currentPath)
			if err != nil {
				c.DebugLogger.Println("Error deleting an old version directory: ", currentPath)
			}
		}
		// Stop the loop after 5 deletions to not create too much overhead
		if deleteCount == maxVersionToDelete {
			break
		}
	}

	return nil
}

func (c *CLI) ExtractV1Binary() error {
	cliV1ExpectedSHA256 := cliv1.ExpectedSHA256()

	isValid, err := embedded.ValidateFile(c.v1BinaryLocation, cliV1ExpectedSHA256, c.DebugLogger)
	if err != nil || !isValid {
		c.DebugLogger.Println("Extract cliv1 to", c.v1BinaryLocation)

		err = cliv1.ExtractTo(c.v1BinaryLocation)
		if err != nil {
			return err
		}

		isValid, err := embedded.ValidateFile(c.v1BinaryLocation, cliV1ExpectedSHA256, c.DebugLogger)
		if err != nil {
			return err
		}

		if isValid {
			c.DebugLogger.Println("Extracted cliv1 successfully")
		} else {
			c.DebugLogger.Println("Extracted cliv1 is not valid")
			return err
		}
	} else {
		c.DebugLogger.Println("Extraction not required")
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

func (c *CLI) commandAbout(proxyInfo *proxy.ProxyInfo, passthroughArgs []string) error {

	err := c.executeV1Default(proxyInfo, passthroughArgs)
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

	// preserve original proxy settings
	inputAsMap[constants.SNYK_HTTPS_PROXY_ENV_SYSTEM], _ = utils.FindValueCaseInsensitive(inputAsMap, constants.SNYK_HTTPS_PROXY_ENV)
	inputAsMap[constants.SNYK_HTTP_PROXY_ENV_SYSTEM], _ = utils.FindValueCaseInsensitive(inputAsMap, constants.SNYK_HTTP_PROXY_ENV)
	inputAsMap[constants.SNYK_HTTP_NO_PROXY_ENV_SYSTEM], _ = utils.FindValueCaseInsensitive(inputAsMap, constants.SNYK_HTTP_NO_PROXY_ENV)

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

		// merge user defined (external) and internal no_proxy configuration
		if len(inputAsMap[constants.SNYK_HTTP_NO_PROXY_ENV_SYSTEM]) > 0 {
			internalNoProxy := strings.Split(constants.SNYK_INTERNAL_NO_PROXY, ",")
			externalNoProxy := regexp.MustCompile("[,;]").Split(inputAsMap[constants.SNYK_HTTP_NO_PROXY_ENV_SYSTEM], -1)
			mergedNoProxy := utils.Merge(internalNoProxy, externalNoProxy)
			inputAsMap[constants.SNYK_HTTP_NO_PROXY_ENV] = strings.Join(mergedNoProxy, ",")
		} else {
			inputAsMap[constants.SNYK_HTTP_NO_PROXY_ENV] = constants.SNYK_INTERNAL_NO_PROXY
		}

		result = utils.ToSlice(inputAsMap, "=")
	}

	return result, err

}

func PrepareV1Command(cmd string, args []string, proxyInfo *proxy.ProxyInfo, integrationName string, integrationVersion string) (snykCmd *exec.Cmd, err error) {
	proxyAddress := fmt.Sprintf("http://%s:%s@127.0.0.1:%d", proxy.PROXY_USERNAME, proxyInfo.Password, proxyInfo.Port)

	snykCmd = exec.Command(cmd, args...)
	snykCmd.Env, err = PrepareV1EnvironmentVariables(os.Environ(), integrationName, integrationVersion, proxyAddress, proxyInfo.CertificateLocation)

	return snykCmd, err
}

func (c *CLI) executeV1Default(proxyInfo *proxy.ProxyInfo, passthroughArgs []string) error {

	snykCmd, err := PrepareV1Command(
		c.v1BinaryLocation,
		passthroughArgs,
		proxyInfo,
		c.GetIntegrationName(),
		GetFullVersion(),
	)

	if c.DebugLogger.Writer() != io.Discard {
		c.DebugLogger.Println("Launching: ")
		c.DebugLogger.Println("  ", c.v1BinaryLocation)
		c.DebugLogger.Println(" With Arguments:")
		c.DebugLogger.Println("  ", strings.Join(passthroughArgs, ", "))
		c.DebugLogger.Println(" With Environment: ")

		variablesMap := utils.ToKeyValueMap(snykCmd.Env, "=")
		listedEnvironmentVariables := []string{
			constants.SNYK_CA_CERTIFICATE_LOCATION_ENV,
			constants.SNYK_HTTPS_PROXY_ENV,
			constants.SNYK_HTTP_PROXY_ENV,
			constants.SNYK_HTTP_NO_PROXY_ENV,
			constants.SNYK_HTTPS_PROXY_ENV_SYSTEM,
			constants.SNYK_HTTP_PROXY_ENV_SYSTEM,
			constants.SNYK_HTTP_NO_PROXY_ENV_SYSTEM,
		}

		for _, key := range listedEnvironmentVariables {
			c.DebugLogger.Println("  ", key, "=", variablesMap[key])
		}

	}

	snykCmd.Stdin = c.stdin
	snykCmd.Stdout = c.stdout
	snykCmd.Stderr = c.stderr

	if err != nil {
		if evWarning, ok := err.(EnvironmentWarning); ok {
			fmt.Println("WARNING! ", evWarning)
		}
	}

	err = snykCmd.Run()

	return err
}

func (c *CLI) Execute(proxyInfo *proxy.ProxyInfo, passthroughArgs []string) error {
	var err error
	handler := determineHandler(passthroughArgs)

	switch {
	case handler == V2_VERSION:
		err = c.commandVersion(passthroughArgs)
	case handler == V2_ABOUT:
		err = c.commandAbout(proxyInfo, passthroughArgs)
	default:
		err = c.executeV1Default(proxyInfo, passthroughArgs)
	}

	return err
}

func DeriveExitCode(err error) int {
	returnCode := constants.SNYK_EXIT_CODE_OK

	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			returnCode = exitError.ExitCode()
		} else {
			// got an error but it's not an ExitError
			returnCode = constants.SNYK_EXIT_CODE_ERROR
		}
	}

	return returnCode
}

func (e EnvironmentWarning) Error() string {
	return e.message
}

func (c *CLI) SetIoStreams(stdin io.Reader, stdout io.Writer, stderr io.Writer) {
	c.stdin = stdin
	c.stdout = stdout
	c.stderr = stderr
}
