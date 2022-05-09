package proxy_test

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"github.com/snyk/cli/cliv2/internal/proxy"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"

	"github.com/stretchr/testify/assert"
)

func Test_closingProxyDeletesTempCert(t *testing.T) {
	debugLogger := log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)

	wp, err := proxy.NewWrapperProxy(false, "", "", debugLogger)
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

	wp, err := proxy.NewWrapperProxy(false, "", "", debugLogger)
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

func Test_xSnykCliVersionHeaderIsReplaced(t *testing.T) {
	debugLogger := log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)

	expectedVersion := "the-cli-version"
	wp, err := proxy.NewWrapperProxy(false, "", expectedVersion, debugLogger)
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

	var capturedVersion string
	ts := httptest.NewServer(http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		capturedVersion = r.Header.Get("x-snyk-cli-version")
	}))
	defer ts.Close()

	// request without the header set
	res, err := proxiedClient.Get(ts.URL)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, 200, res.StatusCode)
	assert.Equal(t, "", capturedVersion)

	// request with the header set
	req, _ := http.NewRequest("GET", ts.URL, nil)
	req.Header.Add("x-snyk-cli-version", "1.0.0")
	res, err = proxiedClient.Do(req)
	if err != nil {
		t.Fatal(err)
	}
	assert.Equal(t, 200, res.StatusCode)
	assert.Equal(t, expectedVersion, capturedVersion)

	wp.Close()
}
