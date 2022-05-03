package main

import (
	"log"
	"os"
	"path"
	"snyk/cling/internal/certs"
	"snyk/cling/internal/utils"
)

func main() {
	certName := os.Args[1]

	debugLogger := log.Default()

	debugLogger.Println("certificate name:", certName)

	certPEMBlockBytes, keyPEMBlockBytes, err := certs.MakeSelfSignedCert(certName, debugLogger)
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
