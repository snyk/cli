package extensions

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"runtime"
)
import flag "github.com/spf13/pflag"

type ExtensionInput struct {
	// TODO: what standard stuff needs to go here?
	TBDMetadata string `json:"tbd"`

	// Extension-specific args
	Args any `json:"args"`
}

type Extension struct {
	ExtensionRoot string
	Metadata      *ExtensionMetadata
}

func NewExtension(extensionRoot string, extensionMetadata *ExtensionMetadata) *Extension {
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

func (e *Extension) MakeLaunchCodes(args []string, debugLogger *log.Logger) (string, error) {
	debugLogger.Println("making launch codes for extension:", e.Metadata.Name)

	extensionArgs := map[string]string{}

	for _, opt := range e.Metadata.Options {
		debugLogger.Println("option:", opt)
		debugLogger.Println("name:", opt.Name)
		debugLogger.Println("shorthand:", opt.Shorthand)
		debugLogger.Println("type:", opt.Type)
		debugLogger.Println("usage:", opt.Usage)

		optionValue := flag.StringP(opt.Name, opt.Shorthand, "", opt.Usage)
		flag.Parse()

		extensionArgs[opt.Name] = *optionValue
	}

	extensionLaunchCodes := ExtensionInput{
		TBDMetadata: "some metadata",
		Args:        extensionArgs,
	}

	launchCodesSerializedBytes, err := json.Marshal(extensionLaunchCodes)
	if err != nil {
		log.Println("error marshalling extension startup message:", err)
		return "", err
	}

	launchCodesSerializedString := string(launchCodesSerializedBytes)
	return string(launchCodesSerializedString), nil
}
