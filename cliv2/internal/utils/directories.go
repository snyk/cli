package utils

import (
	"path"
)

func GetVersionCacheDirectory(baseCacheDirectory string, versionNumber string) string {
	return path.Join(baseCacheDirectory, versionNumber)
}
