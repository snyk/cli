package cliv2

import (
	"github.com/snyk/cli-extension-lib-go/extension"
	"log"
	"os"
	"path"
)

// Load extensions found in the <snyk-cache-dir>/extensions directory.
// If an extension fails to load it fails silently, only logging the failures in debug mode.
func LoadExtensions(cacheDir string, debugLogger *log.Logger) []*extension.Extension {
	loadedExtensions := []*extension.Extension{}

	extensionsDir := path.Join(cacheDir, "extensions")
	debugLogger.Println("extensionsDir:", extensionsDir)

	_, err := os.Stat(extensionsDir)
	if err != nil {
		debugLogger.Println("No extensions directory found in cache directory:", extensionsDir)
		return loadedExtensions
	}

	f, err := os.Open(extensionsDir)
	if err != nil {
		debugLogger.Println("Failed to open extensions directory:", extensionsDir)
		return loadedExtensions
	}

	dirEntries, err := f.ReadDir(0) // 0 means read all directories in the directory (as opposed to some n > 0 which would be a limited number of directories to read)
	if err != nil {
		debugLogger.Println("Failed to read extensions directory:", extensionsDir)
		return loadedExtensions
	}

	for _, dirEntry := range dirEntries {
		if dirEntry.IsDir() {
			debugLogger.Println("dirEntry:", dirEntry.Name())
			extensionDir := path.Join(extensionsDir, dirEntry.Name())

			ext, err := extension.TryLoad(extensionDir)
			if err != nil {
				debugLogger.Println("failed to load extension in directory:", extensionDir)
				debugLogger.Println(err)
			}

			loadedExtensions = append(loadedExtensions, ext)
		}
	}

	return loadedExtensions
}
