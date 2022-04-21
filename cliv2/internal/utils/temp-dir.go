package utils

import (
	"log"
	"os"
	"path"
)

// Gets the system temp directory and, if it doesn't exist, attempts to create it.
func systemTempDirectory(debugLogger *log.Logger) (string, error) {
	tempDir := os.TempDir()
	// make sure this directory exists
	debugLogger.Println("system temp directory:", tempDir)
	_, err := os.Stat(tempDir)
	if err != nil {
		debugLogger.Println("system temp directory does not exist... attempting to create it:", tempDir)
		err = os.MkdirAll(tempDir, 0755)
		if err != nil {
			debugLogger.Println("failed to create system temp directory:", tempDir)
			return "", err
		}
	}

	return tempDir, nil
}

func SnykTempDirectory(debugLogger *log.Logger) (string, error) {
	tempDir, err := systemTempDirectory(debugLogger)
	if err != nil {
		return "", err
	}

	snykTempDir := path.Join(tempDir, "snyk")

	// make sure it exists
	_, err = os.Stat(snykTempDir)
	if err != nil {
		debugLogger.Println("snyk temp directory does not exist... attempting to create it:", snykTempDir)
		err = os.MkdirAll(snykTempDir, 0755)
		if err != nil {
			debugLogger.Println("failed to create snyk temp directory:", snykTempDir)
			return "", err
		}
	}

	return snykTempDir, nil
}
