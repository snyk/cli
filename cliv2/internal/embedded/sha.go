package embedded

import (
	"crypto/sha256"
	"fmt"
	"io/ioutil"
	"log"
)

func ComputeSHA256(filePath string, debugLogger *log.Logger) (string, error) {
	fileBytes, err := ioutil.ReadFile(filePath)
	if err != nil {
		debugLogger.Println("failed to read file:", filePath)
		return "", err
	}

	hash := sha256.Sum256(fileBytes)
	hexString := fmt.Sprintf("%x", hash)

	return hexString, nil
}

func ValidateFile(filePath string, expectedSHA256 string, debugLogger *log.Logger) (bool, error) {
	debugLogger.Println("validating", filePath)

	hashStr, err := ComputeSHA256(filePath, debugLogger)
	if err != nil {
		return false, err
	}

	debugLogger.Println("found sha256:", hashStr)
	debugLogger.Println("expected sha256:", expectedSHA256)

	return hashStr == expectedSHA256, nil
}
