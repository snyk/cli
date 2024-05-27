package embedded

import (
	"crypto/sha256"
	"fmt"
	"log"
	"os"
	"strings"
)

func ComputeSHA256(filePath string, debugLogger *log.Logger) (string, error) {
	fileBytes, err := os.ReadFile(filePath)
	if err != nil {
		return "", err
	}

	hash := sha256.Sum256(fileBytes)
	hexString := fmt.Sprintf("%x", hash)

	return hexString, nil
}

func ValidateFile(filePath string, expectedSHA256 string, debugLogger *log.Logger) (bool, error) {
	debugLogger.Println("Validating sha256 of", filePath)

	hashStr, err := ComputeSHA256(filePath, debugLogger)
	if err != nil {
		debugLogger.Println(" ", err)
		return false, err
	}

	debugLogger.Println("  expected: ", expectedSHA256)
	debugLogger.Println("  actual:   ", hashStr)

	return strings.EqualFold(strings.TrimSpace(hashStr), strings.TrimSpace(expectedSHA256)), nil
}
