//go:build !application

// For tests

package cliv1

import (
	_ "embed"
)

var snykCLIBytes []byte = []byte("\n")

func GetCLIv1Filename() string {
	return "FILENAME"
}

var snykCLISHA256 string = "01ba4719c80b6fe911b091a7c05124b64eeece964e09c058ef8f9805daca546b"

func ExpectedSHA256() string {
	sha256 := snykCLISHA256[0:64]
	return sha256
}
