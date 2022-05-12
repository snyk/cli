package extensions

import (
	"fmt"
	"log"
	"os"
	"path"
	"runtime"
)

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
	log.Println("extensionRoot:", e.ExtensionRoot)
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
