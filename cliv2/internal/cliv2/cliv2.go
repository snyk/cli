/*
Entry point class for the CLIv2 version.
*/
package cliv2

import (
	"bytes"
	_ "embed"
	"fmt"
	"log"
	"os"
	"os/exec"
	"path"
	"strings"

	"github.com/snyk/cli-extension-lib-go"
	"github.com/snyk/cli/cliv2/internal/embedded"
	"github.com/snyk/cli/cliv2/internal/embedded/cliv1"
	"github.com/snyk/cli/cliv2/internal/exit_codes"
	"github.com/snyk/cli/cliv2/internal/extensions"
	"github.com/snyk/cli/cliv2/internal/utils"
)

type Handler int

type CLI struct {
	DebugLogger      *log.Logger
	CacheDirectory   string
	v1BinaryLocation string
	v1Version        string
	v2Version        string
	Extensions       []extensions.Extension
}

type EnvironmentWarning struct {
	message string
}

const SNYK_INTEGRATION_NAME = "CLI_V1_PLUGIN"
const SNYK_INTEGRATION_NAME_ENV = "SNYK_INTEGRATION_NAME"
const SNYK_INTEGRATION_VERSION_ENV = "SNYK_INTEGRATION_VERSION"

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

	loaded_extensions := LoadExtensions(cacheDirectory, debugLogger)
	debugLogger.Println("found extensions:\n", loaded_extensions)

	cli := CLI{
		DebugLogger:      debugLogger,
		CacheDirectory:   cacheDirectory,
		v1Version:        cliv1.CLIV1Version(),
		v2Version:        strings.TrimSpace(SNYK_CLIV2_VERSION_PART),
		v1BinaryLocation: v1BinaryLocation,
		Extensions:       loaded_extensions,
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
	return c.v2Version + "." + c.v1Version
}

func (c *CLI) GetIntegrationName() string {
	return SNYK_INTEGRATION_NAME
}

func (c *CLI) GetBinaryLocation() string {
	return c.v1BinaryLocation
}

func (c *CLI) printVersion() {
	fmt.Println(c.GetFullVersion())
}

type CommandHandler interface {
	Execute(wrapperProxyPort int, fullPathToCert string, passthroughArgs []string) int
}

type VersionHandler struct {
	cli *CLI
}

func (v *VersionHandler) Execute(wrapperProxyPort int, fullPathToCert string, passthroughArgs []string) int {
	if utils.Contains(passthroughArgs, "--json-file-output") {
		fmt.Println("The following option combination is not currently supported: version + json-file-output")
		return exit_codes.SNYK_EXIT_CODE_ERROR
	} else {
		v.cli.printVersion()
		return exit_codes.SNYK_EXIT_CODE_OK
	}
}

// Will return a CommandHandler for a built-in command for a given command (or set of args) if one exists
// By "built-in command", we mean one implemented directly in CLIv2's Go code, not an extension or the wrapped CLIv1
func (c *CLI) matchBuiltInHandler(args []string) CommandHandler {
	if utils.Contains(args, "--version") ||
		utils.Contains(args, "-v") ||
		utils.Contains(args, "version") {
		return &VersionHandler{cli: c}
	}
	return nil
}

func matchExtension(args []string, extensions []extensions.Extension) *extensions.Extension {
	if len(args) > 0 {
		maybeCommand := args[0]
		for _, extension := range extensions {
			if extension.Metadata.Command == maybeCommand {
				return &extension
			}
		}
	}

	return nil
}

func AddIntegrationEnvironment(input []string, name string, version string) (result []string, err error) {
	inputAsMap := utils.ToKeyValueMap(input, "=")
	result = input

	_, integrationNameExists := inputAsMap[SNYK_INTEGRATION_NAME_ENV]
	_, integrationVersionExists := inputAsMap[SNYK_INTEGRATION_VERSION_ENV]

	if !integrationNameExists && !integrationVersionExists {
		inputAsMap[SNYK_INTEGRATION_NAME_ENV] = name
		inputAsMap[SNYK_INTEGRATION_VERSION_ENV] = version
		result = utils.ToSlice(inputAsMap, "=")
	} else if !(integrationNameExists && integrationVersionExists) {
		err = EnvironmentWarning{message: fmt.Sprintf("Partially defined environment, please ensure to provide both %s and %s together!", SNYK_INTEGRATION_NAME_ENV, SNYK_INTEGRATION_VERSION_ENV)}
	}

	return result, err

}

func PrepareV1Command(cmd string, args []string, proxyPort int, caCertLocation string, integrationName string, integrationVersion string) (snykCmd *exec.Cmd, err error) {

	snykCmd = exec.Command(cmd, args...)
	snykCmd.Env = append(os.Environ(),
		fmt.Sprintf("HTTPS_PROXY=http://127.0.0.1:%d", proxyPort),
		fmt.Sprintf("NODE_EXTRA_CA_CERTS=%s", caCertLocation),
	)

	snykCmd.Env, err = AddIntegrationEnvironment(snykCmd.Env, integrationName, integrationVersion)

	snykCmd.Stdin = os.Stdin
	snykCmd.Stdout = os.Stdout
	snykCmd.Stderr = os.Stderr

	return snykCmd, err
}

func (c *CLI) executeV1Default(wrapperProxyPort int, fullPathToCert string, passthroughArgs []string) int {
	c.DebugLogger.Println("launching snyk with path: ", c.v1BinaryLocation)
	c.DebugLogger.Println("fullPathToCert:", fullPathToCert)

	snykCmd, err := PrepareV1Command(
		c.v1BinaryLocation,
		passthroughArgs,
		wrapperProxyPort,
		fullPathToCert,
		c.GetIntegrationName(),
		c.GetFullVersion(),
	)

	if err != nil {
		if evWarning, ok := err.(EnvironmentWarning); ok {
			fmt.Println("WARNING! ", evWarning)
		}
	}

	err = snykCmd.Run()
	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode := exitError.ExitCode()
			return exitCode
		} else {
			// got an error but it's not an ExitError
			fmt.Println(err)
			return exit_codes.SNYK_EXIT_CODE_ERROR
		}
	}

	return exit_codes.SNYK_EXIT_CODE_OK
}

func (c *CLI) Execute(wrapperProxyPort int, fullPathToCert string, passthroughArgs []string) int {
	c.DebugLogger.Println("passthroughArgs", passthroughArgs)

	maybeMatchingBuiltinHandler := c.matchBuiltInHandler(passthroughArgs)
	if maybeMatchingBuiltinHandler != nil {
		c.DebugLogger.Println("matched built-in handler for: ", passthroughArgs)
		return maybeMatchingBuiltinHandler.Execute(wrapperProxyPort, fullPathToCert, passthroughArgs)
	}

	maybeMatchingExtension := matchExtension(passthroughArgs, c.Extensions)
	if maybeMatchingExtension != nil {
		c.DebugLogger.Println("matched extension:", maybeMatchingExtension)
		launchCodes, err := maybeMatchingExtension.MakeLaunchCodes(passthroughArgs, wrapperProxyPort, c.DebugLogger)
		if err != nil {
			fmt.Println(err)
			return exit_codes.SNYK_EXIT_CODE_ERROR
		}
		return LaunchExtension(maybeMatchingExtension, launchCodes, wrapperProxyPort, fullPathToCert, c.DebugLogger)
	}

	c.DebugLogger.Println("No matching built-in handlers or extensions. Falling back on CLIv1")

	// fall-back on CLIv1
	return c.executeV1Default(wrapperProxyPort, fullPathToCert, passthroughArgs)
}

func (e EnvironmentWarning) Error() string {
	return e.message
}

func LaunchExtension(extension *extensions.Extension, launchCodes string, proxyPort int, caCertLocation string, debugLogger *log.Logger) int {
	debugLogger.Println("launching extension:", extension.Metadata.Name)
	debugLogger.Println("launchCodes:\n", launchCodes)

	extensionPath, err := extension.ExecutablePath(debugLogger)
	if err != nil {
		log.Println("error getting extension path:", err)
		return exit_codes.SNYK_EXIT_CODE_ERROR
	}

	debugLogger.Println("extensionPath:", extensionPath)

	cmd := exec.Command(extensionPath)
	cmd.Env = append(os.Environ(),
		fmt.Sprintf("HTTPS_PROXY=http://127.0.0.1:%d", proxyPort),
		fmt.Sprintf("NODE_EXTRA_CA_CERTS=%s", caCertLocation),
	)

	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr
	buffer := bytes.Buffer{}
	buffer.WriteString(launchCodes)
	buffer.WriteString("\n\n")
	cmd.Stdin = &buffer

	cmd.Start()
	err = cmd.Wait()

	if err != nil {
		if exitError, ok := err.(*exec.ExitError); ok {
			exitCode := exitError.ExitCode()
			return exitCode
		} else {
			// got an error but it's not an ExitError
			fmt.Println("error launching extension:", err)
			return exit_codes.SNYK_EXIT_CODE_ERROR
		}
	}

	return exit_codes.SNYK_EXIT_CODE_OK
}

func LoadExtensions(cacheDir string, debugLogger *log.Logger) []extensions.Extension {
	loaded_extensions := []extensions.Extension{}

	extensionsDir := path.Join(cacheDir, "extensions")
	debugLogger.Println("extensionsDir:", extensionsDir)

	_, err := os.Stat(extensionsDir)
	if err != nil {
		debugLogger.Println("No extensions directory found in cache directory:", extensionsDir)
		return loaded_extensions
	}

	f, err := os.Open(extensionsDir)
	if err != nil {
		debugLogger.Println("Failed to open extensions directory:", extensionsDir)
		return loaded_extensions
	}

	dirEntries, err := f.ReadDir(0) // 0 means read all directories in the directory (as opposed to some n > 0 which would be a limited number of directories to read)
	if err != nil {
		debugLogger.Println("Failed to read extensions directory:", extensionsDir)
		return loaded_extensions
	}

	for _, dirEntry := range dirEntries {
		if dirEntry.IsDir() {
			debugLogger.Println("dirEntry:", dirEntry.Name())
			// make sure that it has an extension.json file in it
			extensionDir := path.Join(extensionsDir, dirEntry.Name())
			extensionMetadataPath := path.Join(extensionDir, "extension.json")
			debugLogger.Println("extensionMetadataPath:", extensionMetadataPath)
			_, err := os.Stat(extensionMetadataPath)
			if err == nil {
				extensionMetadata, err := cli_extension_lib_go.DeserExtensionMetadata(extensionMetadataPath)
				if err != nil {
					debugLogger.Println("failed to parse extension metadate file:", extensionMetadataPath)
					debugLogger.Println(err)
				}
				debugLogger.Println("found valid extension metadata file at", extensionMetadataPath)

				ext := extensions.Extension{
					ExtensionRoot: extensionDir,
					Metadata:      extensionMetadata,
				}

				loaded_extensions = append(loaded_extensions, ext)
			} else {
				debugLogger.Println("No extension.json file found in extension directory:", dirEntry.Name())
			}
		}
	}

	return loaded_extensions
}
