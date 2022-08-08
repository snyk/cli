package extension

import (
	"log"
	"os"
	"path"
	"path/filepath"
	"strings"

	"github.com/snyk/cli-extension-lib-go/extension"
	"github.com/snyk/cli/cliv2/internal/embedded"
)

const (
	checksumExtension string      = ".sha"
	metadataFileName  string      = "extension.json"
	cacheSubDirectory string      = "extensions"
	fileMode          os.FileMode = 0755
)

type Configuration struct {
	CacheDirectory string
	Logger         *log.Logger
}

type ExtensionManager struct {
	config              *Configuration
	extensionCacheDir   string
	availableExtensions []*extension.Extension
}

func New(config *Configuration) *ExtensionManager {
	if config.Logger == nil {
		config.Logger = log.Default()
	}

	result := &ExtensionManager{config: config}
	return result
}

func (e *ExtensionManager) Init() (err error) {
	if e.extensionCacheDir == "" {
		e.extensionCacheDir = filepath.Join(e.config.CacheDirectory, cacheSubDirectory)

		// for now always cleanup the extensions on disk to ensure the up-to-date state
		err = e.CleanExtensionsOnDisk()
		if err == nil {
			// for now always save always all extensions to disk
			err = e.SaveExtensionsToDisk()
		}

		if err == nil {
			e.availableExtensions = e.loadExtensions()
		}
	}
	return err
}

func (e *ExtensionManager) CleanExtensionsOnDisk() (err error) {
	e.config.Logger.Printf("Running cleanup")
	//most naive cleanup possible, should be replaced later by more intelligent approaches if necessary
	return os.RemoveAll(e.extensionCacheDir)
}

func (e *ExtensionManager) SaveExtensionsToDisk() (err error) {
	e.config.Logger.Printf("Saving Extensions to disk")

	files := embedded.ListFiles()
	extensionDirectoryList := getListOfExtensions(files)

	// save all files that belong to an extension
	for i := range files {
		path := files[i].Path()
		isPartOfExtension := false
		isChecksumFile := strings.Contains(path, checksumExtension)

		// skip checksum files
		if false == isChecksumFile {
			// check of the current file is part of an extension
			for j := range extensionDirectoryList {
				if strings.Contains(path, extensionDirectoryList[j]) {
					isPartOfExtension = true
					break
				}
			}

			if isPartOfExtension {
				destPath := filepath.Join(e.extensionCacheDir, path)
				e.config.Logger.Printf("Saving %s", destPath)
				err = files[i].SaveToLocalFilesystem(destPath, fileMode)
				if err != nil {
					break
				}
			}
		}
	}

	return err
}

func (e *ExtensionManager) AvailableExtenions() []*extension.Extension {
	return e.availableExtensions
}

// Load extensions found in the <snyk-cache-dir>/extensions directory.
// If an extension fails to load it fails silently, only logging the failures in debug mode.
func (e *ExtensionManager) loadExtensions() []*extension.Extension {
	loadedExtensions := []*extension.Extension{}

	e.config.Logger.Println("Loading extensions from :", e.extensionCacheDir)

	_, err := os.Stat(e.extensionCacheDir)
	if err != nil {
		e.config.Logger.Println("No extensions directory found in cache directory:", e.extensionCacheDir)
		return loadedExtensions
	}

	f, err := os.Open(e.extensionCacheDir)
	if err != nil {
		e.config.Logger.Println("Failed to open extensions directory:", e.extensionCacheDir)
		return loadedExtensions
	}

	dirEntries, err := f.ReadDir(0) // 0 means read all directories in the directory (as opposed to some n > 0 which would be a limited number of directories to read)
	if err != nil {
		e.config.Logger.Println("Failed to read extensions directory:", e.extensionCacheDir)
		return loadedExtensions
	}

	for _, dirEntry := range dirEntries {
		if dirEntry.IsDir() {
			e.config.Logger.Println("Loading:", dirEntry.Name())
			extensionDir := path.Join(e.extensionCacheDir, dirEntry.Name())

			ext, err := extension.TryLoad(extensionDir)
			if err != nil {
				e.config.Logger.Println("failed to load extension in directory:", extensionDir)
				e.config.Logger.Println(err)
				continue
			}

			if ext == nil {
				e.config.Logger.Println("ext is nil - not adding:", extensionDir)
				continue
			} else {
				loadedExtensions = append(loadedExtensions, ext)
			}
		}
	}

	return loadedExtensions
}

//collect all extensions from the file list, based on the existence of the metadata file
func getListOfExtensions(files []embedded.File) (extensionDirectoryList []string) {
	for i := range files {
		name := files[i].Name()
		path := files[i].Path()

		if name == metadataFileName {
			extensionDirectory := filepath.Dir(path)
			extensionDirectoryList = append(extensionDirectoryList, extensionDirectory)
		}
	}
	return extensionDirectoryList
}
