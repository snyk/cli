package utils

import (
	"encoding/json"
	"log"
)

func PrettyLogObject(o any, logger *log.Logger) {
	jsonBytes, err := json.MarshalIndent(o, "", "  ")
	if err != nil {
		logger.Println("error encoding to JSON", err)
	}
	logger.Println(string(jsonBytes))
}
