package extensions

import (
	"encoding/json"
	"fmt"
	"log"
	"os"
	"path"
	"runtime"
)

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

	// TODO: this needs to be dynamic based on
	//   1) the extension's metadata file describing its inputs
	//   2) the args passed into the CLI
	// maybe we could generate a pflag (or just flag) config based on the metadata file and use that
	// to build this map?
	extensionArgs := map[string]string{}
	extensionArgs["lang"] = "foo"

	extensionLaunchCodes := ExtensionInput{
		TBDMetadata: "some metadata", // TODO: just a placeholder until we figure out what field(s) we need here
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
