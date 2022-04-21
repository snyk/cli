package proxy_test

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"github.com/stretchr/testify/assert"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"snyk/cling/internal/proxy"
	"testing"
)

func Test_closingProxyDeletesTempCert(t *testing.T) {
	debugLogger := log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)

	wp, err := proxy.NewWrapperProxy("", []string{"*.snyk.io"}, "", debugLogger)
	assert.Nil(t, err)

	port, err := wp.Start()
	t.Log("proxy port:", port)
	assert.Nil(t, err)

	wp.Close()

	// assert cert file is deleted
	_, err = os.Stat(wp.CertificateLocation)
	assert.NotNil(t, err) // this means the file is gone
}

func Test_canGoThroughProxy(t *testing.T) {
	debugLogger := log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)

	wp, err := proxy.NewWrapperProxy("", []string{"static.snyk.io"}, "", debugLogger)
	assert.Nil(t, err)

	port, err := wp.Start()
	assert.Nil(t, err)
	t.Log("proxy listening on port:", port)

	rootCAs, _ := x509.SystemCertPool()
	if rootCAs == nil {
		rootCAs = x509.NewCertPool()
	}

	proxyCertBytes, err := ioutil.ReadFile(wp.CertificateLocation)
	assert.Nil(t, err)
	ok := rootCAs.AppendCertsFromPEM(proxyCertBytes)
	assert.True(t, ok)

	config := &tls.Config{
		InsecureSkipVerify: false,
		RootCAs:            rootCAs,
	}

	proxyUrl, err := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", port))
	proxiedClient := &http.Client{Transport: &http.Transport{
		Proxy:           http.ProxyURL(proxyUrl),
		TLSClientConfig: config,
	}}
	assert.Nil(t, err)

	res, err := proxiedClient.Get("https://static.snyk.io/cli/latest/version")
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, 200, res.StatusCode)

	wp.Close()

	// assert cert file is deleted on Close
	_, err = os.Stat(wp.CertificateLocation)
	assert.NotNil(t, err) // this means the file is gone
}
