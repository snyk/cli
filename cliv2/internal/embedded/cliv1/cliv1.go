package cliv1

import (
	_ "embed"
	"path"
	"snyk/cling/internal/embedded"
	"snyk/cling/internal/utils"
	"strings"
)

//go:embed cliv1.version
var snykCLIVersion string

func CLIV1Version() string {
	return strings.TrimSpace(snykCLIVersion)
}

// Get the full path to where we expect the CLIv1 to be in the cache
// If it doesn't exist, this is the path where we will then extract it
func GetFullCLIV1TargetPath(cacheDir string) (string, error) {
	cliv1Filename := getCLIv1Filename()
	versionTag := CLIV1Version()
	relPath := path.Join(versionTag, cliv1Filename)
	fullPath, err := utils.FullPathInSnykCacheDir(cacheDir, relPath)
	if err != nil {
		return "", err
	}
	return fullPath, nil
}

func ExtractTo(targetFullPath string) error {
	return embedded.ExtractBytesToTarget(snykCLIBytes, targetFullPath)
}
