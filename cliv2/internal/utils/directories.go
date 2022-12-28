package utils

import (
	"os"
	"path"

	"github.com/pkg/errors"
)

// The directory structure used to cache things into
// - Base cache directory (user definable, default depends on OS, exmple:  /Users/username/Library/Caches/snyk/)
// |- Version cache directory (example: /Users/username/Library/Caches/snyk/1.1075.0/)
//  |- Temp directory (example: /Users/username/Library/Caches/snyk/1.1075.0/tmp/)

func GetTemporaryDirectory(baseCacheDirectory string, versionNumber string) string {
	return path.Join(GetVersionCacheDirectory(baseCacheDirectory, versionNumber), "tmp")
}

func GetVersionCacheDirectory(baseCacheDirectory string, versionNumber string) string {
	return path.Join(baseCacheDirectory, versionNumber)
}

func CreateAllDirectories(baseCacheDirectory string, versionNumber string) error {
	directoryList := []string{
		GetTemporaryDirectory(baseCacheDirectory, versionNumber),
	}

	for _, dir := range directoryList {
		err := os.MkdirAll(dir, 0755)
		if err != nil {
			return errors.Wrap(err, "failed to create all directories.")
		}
	}

	return nil
}
