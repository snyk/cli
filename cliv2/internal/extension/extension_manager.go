package extension

import (
	"os"
	"path/filepath"

	"github.com/snyk/cli/cliv2/internal/embedded"
)

const (
	metadataFileName  string      = "extension.json"
	cacheSubDirectory string      = "extensions"
	fileMode          os.FileMode = 0755
)

type Configuration struct {
	CacheDirectory string
}

type ExtensionManager struct {
	config            *Configuration
	extensionCacheDir string
}

func New(config *Configuration) *ExtensionManager {
	result := &ExtensionManager{config: config}
	return result
}

func (e *ExtensionManager) Init() (err error) {

	if e.extensionCacheDir == "" {
		e.extensionCacheDir = filepath.Join(e.config.CacheDirectory, cacheSubDirectory)

		files := embedded.ListFiles()
		for i := range files {
			name := files[i].Name()
			path := files[i].Path()
			if name == metadataFileName {
				file := filepath.Join(e.extensionCacheDir, path)
				size := files[i].Size()
				data := make([]byte, size)

				_, err = files[i].Read(data)
				if err == nil {
					folder := filepath.Dir(file)
					_, err = os.Stat(folder)
					if os.IsNotExist(err) {
						err = os.MkdirAll(folder, fileMode)
					}
				}

				if err == nil {
					err = os.WriteFile(file, data, fileMode)
				}

				if err != nil {
					break
				}
			}
		}
	}

	return err
}
