/*
Entry point class for the CLIv2 version.
*/
package cliv2

import (
	"context"
	_ "embed"
	"errors"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path"
	"path/filepath"
	"regexp"
	"slices"
	"strings"
	"time"

	"github.com/gofrs/flock"
	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/snyk/error-catalog-golang-public/snyk_errors"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/instrumentation"
	"github.com/snyk/go-application-framework/pkg/local_workflows/output_workflow"
	"github.com/snyk/go-application-framework/pkg/runtimeinfo"
	"github.com/snyk/go-application-framework/pkg/utils"

	cli_errors "github.com/snyk/cli/cliv2/internal/errors"

	"github.com/snyk/cli/cliv2/internal/constants"
	debug_utils "github.com/snyk/cli/cliv2/internal/debug"
	"github.com/snyk/cli/cliv2/internal/embedded"
	"github.com/snyk/cli/cliv2/internal/embedded/cliv1"
	"github.com/snyk/cli/cliv2/internal/proxy"
)

type Handler int

type CLI struct {
	DebugLogger      *log.Logger
	CacheDirectory   string
	WorkingDirectory string
	v1BinaryLocation string
	stdin            io.Reader
	stdout           io.Writer
	stderr           io.Writer
	env              []string
	globalConfig     configuration.Configuration
}

type EnvironmentWarning struct {
	message string
}

const (
	V1_DEFAULT Handler = iota
	V2_VERSION Handler = iota
	V2_ABOUT   Handler = iota
)

const (
	configKeyErrFile         = "INTERNAL_ERR_FILE_PATH"
	ERROR_HAS_BEEN_DISPLAYED = "hasBeenDisplayed"
)

var (
	ErrIPCNotNeeded           = errors.New("no IPC communication was needed")
	ErrIPCNoDataSent          = errors.New("no data was sent through the IPC")
	ErrIPCFailedToRead        = errors.New("error while reading IPC file")
	ErrIPCFailedToDeserialize = errors.New("error while deserializing IPC file")
)

func NewCLIv2(config configuration.Configuration, debugLogger *log.Logger, ri runtimeinfo.RuntimeInfo) (*CLI, error) {
	cacheDirectory := config.GetString(configuration.CACHE_PATH)

	v1BinaryLocation := path.Join(cacheDirectory, ri.GetVersion(), cliv1.GetCLIv1Filename())

	cli := CLI{
		DebugLogger:      debugLogger,
		CacheDirectory:   cacheDirectory,
		WorkingDirectory: "",
		v1BinaryLocation: v1BinaryLocation,
		stdin:            os.Stdin,
		stdout:           os.Stdout,
		stderr:           os.Stderr,
		env:              os.Environ(),
		globalConfig:     config,
	}

	return &cli, nil
}

// SetV1BinaryLocation for testing purposes
func (c *CLI) SetV1BinaryLocation(filePath string) {
	c.v1BinaryLocation = filePath
}

func (c *CLI) Init() (err error) {
	c.DebugLogger.Println("Init start")

	if len(c.CacheDirectory) > 0 {
		// ensure the specified base cache directory exists, this needs to be done even before acquiring the lock
		if _, err = os.Stat(c.CacheDirectory); os.IsNotExist(err) {
			err = os.MkdirAll(c.CacheDirectory, utils.DIR_PERMISSION)
			if err != nil {
				return fmt.Errorf("Cache directory path is invalid: %w", err)
			}
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
		_ = fileLock.Unlock()
		_ = os.Remove(lockFileName)
	}
	defer unlock()

	c.DebugLogger.Printf("Init-Lock acquired: %v (%s)\n", fileLock.Locked(), lockFileName)

	// create required cache and temp directories
	err = utils.CreateAllDirectories(c.CacheDirectory, GetFullVersion())
	if err != nil {
		return err
	}

	// cleanup cache a bit
	_ = c.ClearCache()

	// extract cliv1
	err = c.ExtractV1Binary()
	if err != nil {
		return err
	}

	c.DebugLogger.Println("Init end")

	return err
}

func (c *CLI) ClearCache() error {
	err := c.clearVersionFolders()
	return err
}

func (c *CLI) clearVersionFolders() error {
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

func (c *CLI) AppendEnvironmentVariables(env []string) {
	c.env = append(c.env, env...)
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
			return fmt.Errorf("failed to extract legacy cli")
		}
	} else {
		c.DebugLogger.Println("Extraction not required")
	}

	return nil
}

func GetFullVersion() string {
	v1Version := cliv1.CLIV1Version()
	return v1Version
}

func (c *CLI) GetIntegrationName() string {
	return constants.SNYK_INTEGRATION_NAME
}

func (c *CLI) GetBinaryLocation() string {
	return c.v1BinaryLocation
}

func (c *CLI) GetTempDir() string {
	return c.globalConfig.GetString(configuration.TEMP_DIR_PATH)
}

func (c *CLI) printVersion() {
	_, _ = fmt.Fprintln(c.stdout, GetFullVersion())
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

	const separator = "\n+-+-+-+-+-+-+\n\n\n"

	allEmbeddedFiles, err := embedded.ListFiles()
	if err != nil {
		return err
	}
	for i := range allEmbeddedFiles {
		f := &allEmbeddedFiles[i]
		fPath := f.Path()

		if strings.Contains(fPath, "licenses") {
			size := f.Size()
			data := make([]byte, size)
			_, err := f.Read(data)
			if err != nil {
				continue
			}

			fmt.Printf("Package: %s \n", strings.ReplaceAll(strings.ReplaceAll(fPath, "/licenses/", ""), "/"+f.Name(), ""))
			_, _ = fmt.Fprintln(c.stdout, string(data))
			_, _ = fmt.Fprint(c.stdout, separator)
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
	} else if utils.Contains(passthroughArgs, "--about") ||
		utils.Contains(passthroughArgs, "about") {
		result = V2_ABOUT
	}

	return result
}

func PrepareV1EnvironmentVariables(
	input []string,
	integrationName string,
	integrationVersion string,
	proxyAddress string,
	caCertificateLocation string,
	config configuration.Configuration,
	args []string,
) (result []string, err error) {
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
			constants.SNYK_OPENSSL_CONF,
			constants.SNYK_INTERNAL_PREVIEW_FEATURES_ENABLED,
		}

		for _, key := range blackList {
			inputAsMap = utils.Remove(inputAsMap, key)
		}

		// fill expected values
		inputAsMap[constants.SNYK_HTTPS_PROXY_ENV] = proxyAddress
		inputAsMap[constants.SNYK_HTTP_PROXY_ENV] = proxyAddress
		inputAsMap[constants.SNYK_CA_CERTIFICATE_LOCATION_ENV] = caCertificateLocation

		fillEnvironmentFromConfig(inputAsMap, config, args)

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

// Fill environment variables for the legacy CLI from the given configuration.
func fillEnvironmentFromConfig(inputAsMap map[string]string, config configuration.Configuration, args []string) {
	inputAsMap[constants.SNYK_INTERNAL_ORGID_ENV] = config.GetString(configuration.ORGANIZATION)
	inputAsMap[constants.SNYK_INTERNAL_ERR_FILE] = config.GetString(configKeyErrFile)
	inputAsMap[constants.SNYK_TEMP_PATH] = config.GetString(configuration.TEMP_DIR_PATH)

	if config.GetBool(configuration.PREVIEW_FEATURES_ENABLED) {
		inputAsMap[constants.SNYK_INTERNAL_PREVIEW_FEATURES_ENABLED] = "1"
	}

	inputAsMap[constants.SNYK_ENDPOINT_ENV] = config.GetString(configuration.API_URL)

	if debug_utils.GetDebugLevel(config) == zerolog.TraceLevel {
		inputAsMap["DEBUG"] = "*"
	}

	_, orgEnVarExists := inputAsMap[constants.SNYK_ORG_ENV]
	if !utils.ContainsPrefix(args, "--org=") &&
		!orgEnVarExists &&
		config.IsSet(configuration.ORGANIZATION) {
		inputAsMap[constants.SNYK_ORG_ENV] = config.GetString(configuration.ORGANIZATION)
	}
}

func (c *CLI) PrepareV1Command(
	ctx context.Context,
	cmd string,
	args []string,
	proxyInfo *proxy.ProxyInfo,
	integrationName string,
	integrationVersion string,
) (snykCmd *exec.Cmd, err error) {
	proxyAddress := fmt.Sprintf("http://%s:%s@127.0.0.1:%d", proxy.PROXY_USERNAME, proxyInfo.Password, proxyInfo.Port)
	snykCmd = exec.CommandContext(ctx, cmd, args...)
	snykCmd.Env, err = PrepareV1EnvironmentVariables(c.env, integrationName, integrationVersion, proxyAddress, proxyInfo.CertificateLocation, c.globalConfig, args)

	if len(c.WorkingDirectory) > 0 {
		snykCmd.Dir = c.WorkingDirectory
	}

	return snykCmd, err
}

func (c *CLI) executeV1Default(proxyInfo *proxy.ProxyInfo, passThroughArgs []string) error {
	timeout := c.globalConfig.GetInt(configuration.TIMEOUT)
	var ctx context.Context
	var cancel context.CancelFunc
	if timeout == 0 {
		ctx = context.Background()
	} else {
		ctx, cancel = context.WithTimeout(context.Background(), time.Duration(timeout)*time.Second)
		defer cancel()
	}

	filePath := filepath.Join(c.globalConfig.GetString(configuration.TEMP_DIR_PATH), fmt.Sprintf("err-file-%s", uuid.NewString()))
	c.globalConfig.Set(configKeyErrFile, filePath)

	snykCmd, err := c.PrepareV1Command(ctx, c.v1BinaryLocation, passThroughArgs, proxyInfo, c.GetIntegrationName(), GetFullVersion())

	if c.DebugLogger.Writer() != io.Discard {
		c.DebugLogger.Println("Launching: ")
		c.DebugLogger.Println("  ", c.v1BinaryLocation)
		c.DebugLogger.Println(" With Arguments:")
		c.DebugLogger.Println(" ", strings.Join(passThroughArgs, " "))
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
			constants.SNYK_ANALYTICS_DISABLED_ENV,
			constants.SNYK_ENDPOINT_ENV,
			constants.SNYK_ORG_ENV,
		}

		for _, key := range listedEnvironmentVariables {
			if value, exists := variablesMap[key]; exists {
				c.DebugLogger.Println("  ", key, "=", value)
			}
		}
	}

	snykCmd.Stdin = c.stdin
	snykCmd.Stdout = c.stdout
	snykCmd.Stderr = c.stderr

	if err != nil {
		var evWarning EnvironmentWarning
		if errors.As(err, &evWarning) {
			_, _ = fmt.Fprintln(c.stdout, "WARNING! ", evWarning)
		}
	}

	err = snykCmd.Run()
	if errors.Is(ctx.Err(), context.DeadlineExceeded) {
		return ctx.Err()
	}

	sentErr, ipcErr := GetErrorFromFile(err, filePath, c.globalConfig)
	if ipcErr != nil {
		if !errors.Is(ipcErr, ErrIPCNotNeeded) {
			c.DebugLogger.Println("IPC: ", ipcErr.Error())
		}
		return err
	}

	return sentErr
}

func GetErrorFromFile(execErr error, errFilePath string, config configuration.Configuration) (data error, ipcReadErr error) {
	if execErr == nil {
		return nil, ErrIPCNotNeeded
	}

	if exitErr, ok := execErr.(*exec.ExitError); ok && exitErr.ExitCode() < 2 {
		return nil, ErrIPCNotNeeded
	}

	bytes, fileErr := os.ReadFile(errFilePath)
	if os.IsNotExist(fileErr) {
		return nil, ErrIPCNoDataSent
	}

	if fileErr != nil {
		return nil, fmt.Errorf("%w: %w", ErrIPCFailedToRead, fileErr)
	}

	jsonErrors, serErr := snyk_errors.FromJSONAPIErrorBytes(bytes)
	if serErr != nil {
		return nil, fmt.Errorf("%w: %w", ErrIPCFailedToDeserialize, serErr)
	}

	if len(jsonErrors) != 0 {
		hasBeenDisplayed := GetErrorDisplayStatus(config)

		errs := make([]error, len(jsonErrors)+1)
		errs = append(errs, execErr)
		for _, jerr := range jsonErrors {
			jerr.Meta["orign"] = "Typescript-CLI"
			jerr.Meta[ERROR_HAS_BEEN_DISPLAYED] = hasBeenDisplayed
			errs = append(errs, jerr)
		}

		return errors.Join(errs...), nil
	}

	return nil, ErrIPCNoDataSent
}

func (c *CLI) Execute(proxyInfo *proxy.ProxyInfo, passThroughArgs []string) error {
	var err error
	handler := determineHandler(passThroughArgs)

	switch {
	case handler == V2_VERSION:
		err = c.commandVersion(passThroughArgs)
	case handler == V2_ABOUT:
		err = c.commandAbout(proxyInfo, passThroughArgs)
	default:
		err = c.executeV1Default(proxyInfo, passThroughArgs)
	}

	return err
}

func DeriveExitCode(err error) int {
	returnCode := constants.SNYK_EXIT_CODE_OK

	if err != nil {
		var exitError *exec.ExitError
		var errorWithExitCode *cli_errors.ErrorWithExitCode

		if errors.As(err, &exitError) {
			returnCode = exitError.ExitCode()
			// map errors in subprocesses to exit code 2 to remain the documented exit code range
			if returnCode < 0 || returnCode == constants.SNYK_EXIT_CODE_TS_CLI_TERMINATED {
				returnCode = constants.SNYK_EXIT_CODE_ERROR
			}
		} else if errors.Is(err, context.DeadlineExceeded) {
			returnCode = constants.SNYK_EXIT_CODE_EX_UNAVAILABLE
		} else if errors.As(err, &errorWithExitCode) {
			returnCode = errorWithExitCode.ExitCode
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

func DetermineInputDirectory(args []string) string {
	for _, v := range args {
		if v == "--" {
			break
		}

		isCommand := slices.Contains(instrumentation.KNOWN_COMMANDS, v)
		isFlag := strings.HasPrefix(v, "-")
		if !isCommand && !isFlag {
			return v
		}
	}
	return ""
}

// GetErrorDisplayStatus computes whether the IPC error was displayed by the TS CLI or not. It accounts for
// the usage of STDIO and the presence of the JSON flag when the Legacy CLI was invoked.
func GetErrorDisplayStatus(config configuration.Configuration) bool {
	useSTDIO := config.GetBool(configuration.WORKFLOW_USE_STDIO)
	jsonEnabled := config.GetBool(output_workflow.OUTPUT_CONFIG_KEY_JSON)

	hasBeenDisplayed := false
	if useSTDIO && jsonEnabled {
		hasBeenDisplayed = true
	}

	return hasBeenDisplayed
}
