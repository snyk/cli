package certs

import (
	"bytes"
	"crypto/rand"
	"crypto/rsa"
	"crypto/x509"
	"crypto/x509/pkix"
	"encoding/pem"
	"fmt"
	"log"
	"math/big"
	"time"
)

func MakeSelfSignedCert(certName string, dnsNames []string, debugLogger *log.Logger) (certPEMBlock []byte, keyPEMBlock []byte, err error) {
	// create a key
	privateKey, err := rsa.GenerateKey(rand.Reader, 2048)
	if err != nil {
		return nil, nil, err
	}

	// create a self-signed cert using the key
	template := x509.Certificate{
		SerialNumber: big.NewInt(1),
		Subject: pkix.Name{
			CommonName: certName,
		},
		NotBefore: time.Now(),
		NotAfter:  time.Now().Add(time.Hour * 24 * 365),

		KeyUsage: x509.KeyUsageDigitalSignature |
			x509.KeyUsageKeyEncipherment |
			x509.KeyUsageKeyAgreement |
			x509.KeyUsageCertSign, // needed for sure

		ExtKeyUsage: []x509.ExtKeyUsage{x509.ExtKeyUsageServerAuth},
		BasicConstraintsValid: true,
		IsCA: true,
	}

	for _, dnsName := range dnsNames {
		template.DNSNames = append(template.DNSNames, dnsName)
		debugLogger.Println("MakeSelfSignedCert added ", dnsName)
	}

	certDERBytes, err_CreateCertificate := x509.CreateCertificate(rand.Reader, &template, &template, &privateKey.PublicKey, privateKey)
	if err_CreateCertificate != nil {
		return nil, nil, err
	}

	certPEMBytesBuffer := &bytes.Buffer{}
	if err := pem.Encode(certPEMBytesBuffer, &pem.Block{Type: "CERTIFICATE", Bytes: certDERBytes}); err != nil {
		fmt.Println(err)
		return nil, nil, err
	}

	// make the key pem
	keyDERBytes := x509.MarshalPKCS1PrivateKey(privateKey)
	keyPEMBytesBuffer := &bytes.Buffer{}
	if err := pem.Encode(keyPEMBytesBuffer, &pem.Block{Type: "RSA PRIVATE KEY", Bytes: keyDERBytes}); err != nil {
		return nil, nil, err
	}

	certPEMBlockBytes := certPEMBytesBuffer.Bytes()
	keyPEMBlockBytes := keyPEMBytesBuffer.Bytes()

	return certPEMBlockBytes, keyPEMBlockBytes, nil
}
