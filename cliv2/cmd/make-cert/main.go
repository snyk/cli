package main

import (
	"fmt"
	"log"
	"os"
	"path"
	"strings"

	"github.com/snyk/cli/cliv2/internal/utils"
	"github.com/snyk/go-application-framework/pkg/networking/certs"
)

func main() {
	certName := os.Args[1]

	debugLogger := log.Default()

	snykDNSNamesStr := os.Getenv("SNYK_DNS_NAMES")
	var snykDNSNames []string
	fmt.Println("SNYK_DNS_NAMES:", snykDNSNamesStr)
	if snykDNSNamesStr != "" {
		snykDNSNames = strings.Split(snykDNSNamesStr, ",")
	} else {
		// We use app.dev.snyk.io for development
		snykDNSNames = []string{"snyk.io", "*.snyk.io", "*.dev.snyk.io"}
	}

	debugLogger.Println("certificate name:", certName)
	debugLogger.Println("SNYK_DNS_NAMES:", snykDNSNames)

	certPEMBlockBytes, keyPEMBlockBytes, err := certs.MakeSelfSignedCert(certName, snykDNSNames, debugLogger)
	if err != nil {
		log.Fatal(err)
	}

	// certString := certPEMBytesBuffer.String()
	certPEMString := string(certPEMBlockBytes)
	keyPEMString := string(keyPEMBlockBytes)

	keyAndCert := keyPEMString + certPEMString

	// write to file
	certFilePath := path.Join(".", certName+".crt")
	keyFilePath := path.Join(".", certName+".key")
	joinedPemFilePath := path.Join(".", certName+".pem") // key and cert in one file - used by mitmproxy

	_ = utils.WriteToFile(certFilePath, certPEMString)
	_ = utils.WriteToFile(keyFilePath, keyPEMString)
	_ = utils.WriteToFile(joinedPemFilePath, keyAndCert)
}
