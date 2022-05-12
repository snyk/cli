package extensions

import (
	"encoding/json"
	"log"
	"os"
	"path"
)

type ExtensionMetadata struct {
	Name            string   `json:"name"`
	Command         string   `json:"command"`
	Version         string   `json:"version"`
	HelpDescription string   `json:"help_description"`
	Options         []Option `json:"options"`
}

type Option struct {
	Name string `json:"name"`
	Type string `json:"type"`
}

func LoadExtensions(cacheDir string, debugLogger *log.Logger) []Extension {
	extensions := []Extension{}

	extensionsDir := path.Join(cacheDir, "extensions")
	debugLogger.Println("extensionsDir:", extensionsDir)

	_, err := os.Stat(extensionsDir)
	if err != nil {
		debugLogger.Println("No extensions directory found in cache directory:", extensionsDir)
		return extensions
	}

	f, err := os.Open(extensionsDir)
	if err != nil {
		debugLogger.Println("Failed to open extensions directory:", extensionsDir)
		return extensions
	}

	dirEntries, err := f.ReadDir(0) // 0 means read all directories in the directory (as opposed to some n > 0 which would be a limited number of directories to read)
	if err != nil {
		debugLogger.Println("Failed to read extensions directory:", extensionsDir)
		return extensions
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
				ext, err := LoadExtension(extensionDir, extensionMetadataPath, debugLogger)
				if err != nil {
					debugLogger.Println("failed to parse extension metadate file:", extensionMetadataPath)
					debugLogger.Println(err)
				}
				debugLogger.Println("found valid extension metadata file at", extensionMetadataPath)
				extensions = append(extensions, *ext)
			} else {
				debugLogger.Println("No extension.json file found in extension directory:", dirEntry.Name())
			}
		}
	}

	return extensions
}

func LoadExtension(extensionDir string, extensionPath string, debugLogger *log.Logger) (*Extension, error) {
	bytes, err := os.ReadFile(extensionPath)
	if err != nil {
		debugLogger.Println("Failed to read extension file:", extensionPath)
		return nil, err
	}
	var extensionMetadata ExtensionMetadata
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
