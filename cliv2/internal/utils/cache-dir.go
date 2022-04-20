package utils

import (
	"os"
	"path"
)

func SnykCacheDir() (string, error) {
	baseDirectory, err := os.UserCacheDir()
	if err != nil {
		return "", err
	}

	snykCacheDir := path.Join(baseDirectory, "snyk")
	err = os.MkdirAll(snykCacheDir, 0755)
	if err != nil {
		return "", err
	}

	return snykCacheDir, nil
}

func FullPathInSnykCacheDir(cacheDir string, filename string) (string, error) {
	return path.Join(cacheDir, filename), nil
}
