package extensions

import (
	"encoding/json"
	"fmt"
	"github.com/snyk/cli/cliv2/internal/extension_metadata"
	"log"
	"os"
	"path"
	"runtime"
)
import flag "github.com/spf13/pflag"

type ExtensionInput struct {
	// Standard stuff do we want to passed to all extensions
	Debug     bool `json:"debug"`
	ProxyPort int  `json:"proxy_port"`

	// Extension-specific args
	Args any `json:"args"`
}

type Extension struct {
	ExtensionRoot string
	Metadata      *extension_metadata.ExtensionMetadata
}

func NewExtension(extensionRoot string, extensionMetadata *extension_metadata.ExtensionMetadata) *Extension {
	return &Extension{
		ExtensionRoot: extensionRoot,
		Metadata:      extensionMetadata,
	}
}

func (e *Extension) ExtensionBinaryPostfix() (string, error) {
	goarch := runtime.GOARCH
	goos := runtime.GOOS

	switch {
	case goos == "darwin" && goarch == "amd64":
		return "darwin_amd64", nil
	case goos == "darwin" && goarch == "arm64":
		return "darwin_amd64", nil // TODO: update when we support arm64 natively on Mac
	case goos == "linux" && goarch == "amd64":
		return "linux_amd64", nil
	case goos == "linux" && goarch == "arm64":
		return "linux_arm64", nil
	case goos == "windows" && goarch == "amd64":
		return "windows_amd64", nil
	case goos == "windows" && goarch == "amd64":
		return "windows_amd64", nil
	default:
		return "", fmt.Errorf("unsupported platform: goos=%s and goarch=%s", goos, goarch)
	}
}

func (e *Extension) ExecutablePath(debugLogger *log.Logger) (string, error) {
	debugLogger.Println("extensionRoot:", e.ExtensionRoot)
	if _, err := os.Stat(e.ExtensionRoot); os.IsNotExist(err) {
		log.Println("extension root dir does not exist:", e.ExtensionRoot)
		return "", err
	}
	postfix, err := e.ExtensionBinaryPostfix()
	if err != nil {
		return "", err
	}
	binaryFilename := fmt.Sprintf("%s_%s", e.Metadata.Name, postfix)
	binaryFullPath := path.Join(e.ExtensionRoot, binaryFilename)
	return binaryFullPath, nil
}

// Builds the JSON string required to pass to stdin of an extension when launching it
// based on 1) the CLI args and 2) the extension's metadata
func (e *Extension) MakeLaunchCodes(args []string, proxyPort int, debugLogger *log.Logger) (string, error) {
	debugLogger.Println("making launch codes for extension:", e.Metadata.Name)

	extensionArgs := map[string]string{}

	// this is to make flag.Parse not complain about the --debug or -d flags getting passed through
	// and also determine whether we should set `Debug` in the
	// it might be better to remove these from args[] if they are present and then pass through debug bool
	// from main.go through cliv2.go and into here.
	debug := flag.BoolP("debug", "d", false, "debug mode")
	debugLogger.Println("debug:", *debug)

	for _, opt := range e.Metadata.Options {
		debugLogger.Println("option:", opt)
		debugLogger.Println("name:", opt.Name)
		debugLogger.Println("shorthand:", opt.Shorthand)
		debugLogger.Println("type:", opt.Type)
		debugLogger.Println("usage:", opt.Usage)

		optionValue := flag.StringP(opt.Name, opt.Shorthand, "", opt.Usage)

		// todo: does this need to go outside the loop?
		flag.Parse()

		extensionArgs[opt.Name] = *optionValue
	}

	extensionLaunchCodes := ExtensionInput{
		// Debug:     *debug,
		Debug:     *debug,
		ProxyPort: proxyPort,
		Args:      extensionArgs,
	}

	launchCodesSerializedBytes, err := json.Marshal(extensionLaunchCodes)
	if err != nil {
		log.Println("error marshalling extension startup message:", err)
		return "", err
	}

	launchCodesSerializedString := string(launchCodesSerializedBytes)
	return string(launchCodesSerializedString), nil
}

func LoadExtension(extensionDir string, extensionPath string, debugLogger *log.Logger) (*Extension, error) {
	bytes, err := os.ReadFile(extensionPath)
	if err != nil {
		debugLogger.Println("Failed to read extension file:", extensionPath)
		return nil, err
	}
	var extensionMetadata extension_metadata.ExtensionMetadata
	err = json.Unmarshal(bytes, &extensionMetadata)
	if err != nil {
		debugLogger.Println("Failed to unmarshal extension.json file, ", extensionPath)
		return nil, err
	}

	return &Extension{
		ExtensionRoot: extensionDir,
		Metadata:      &extensionMetadata,
	}, nil
}
