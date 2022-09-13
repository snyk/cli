package proxy_test

import (
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/http/httptest"
	"net/url"
	"os"
	"testing"

	"github.com/snyk/cli/cliv2/internal/proxy"
	"github.com/snyk/go-httpauth/pkg/httpauth"

	"github.com/stretchr/testify/assert"
)

var debugLogger *log.Logger = log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)

func helper_getHttpClient(gateway *proxy.WrapperProxy) (*http.Client, error) {
	rootCAs, _ := x509.SystemCertPool()
	if rootCAs == nil {
		rootCAs = x509.NewCertPool()
	}

	proxyCertBytes, err := ioutil.ReadFile(gateway.CertificateLocation)
	if err != nil {
		return nil, err
	}

	ok := rootCAs.AppendCertsFromPEM(proxyCertBytes)
	if ok == false {
		return nil, fmt.Errorf("failed to append proxy cert")
	}

	config := &tls.Config{
		InsecureSkipVerify: false,
		RootCAs:            rootCAs,
	}

	proxyUrl, err := url.Parse(fmt.Sprintf("http://127.0.0.1:%d", gateway.Port()))
	if err != nil {
		return nil, err
	}

	proxiedClient := &http.Client{Transport: &http.Transport{
		Proxy:           http.ProxyURL(proxyUrl),
		TLSClientConfig: config,
	}}

	return proxiedClient, nil
}

func Test_closingProxyDeletesTempCert(t *testing.T) {
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
	wp, err := proxy.NewWrapperProxy(false, "", "", debugLogger)
	assert.Nil(t, err)

	_, err = wp.Start()
	assert.Nil(t, err)

	proxiedClient, err := helper_getHttpClient(wp)
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
	expectedVersion := "the-cli-version"
	wp, err := proxy.NewWrapperProxy(false, "", expectedVersion, debugLogger)
	assert.Nil(t, err)

	_, err = wp.Start()
	assert.Nil(t, err)

	proxiedClient, err := helper_getHttpClient(wp)
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

func Test_SetUpstreamProxy(t *testing.T) {
	var err error
	var objectUnderTest *proxy.WrapperProxy

	testUrl, _ := url.Parse("http://www.snyk.io")
	testRequest := http.Request{URL: testUrl}

	upstreanProxyUrlAsString := "http://localhost:3128"
	expectedUpstreamProxyUrl, _ := url.Parse(upstreanProxyUrlAsString)

	// using different cases to determine whether the proxy actually switches the mode authentication mode
	testCaseList := []httpauth.AuthenticationMechanism{
		httpauth.Negotiate,
		httpauth.AnyAuth,
		httpauth.NoAuth,
		httpauth.UnknownMechanism,
	}

	objectUnderTest, err = proxy.NewWrapperProxy(false, "", "", debugLogger)
	assert.Nil(t, err)

	// running different cases
	for i := range testCaseList {
		currentMechanism := testCaseList[i]
		t.Logf(" - using %s", httpauth.StringFromAuthenticationMechanism(currentMechanism))

		objectUnderTest.SetUpstreamProxyAuthentication(currentMechanism)
		objectUnderTest.SetUpstreamProxyFromUrl(upstreanProxyUrlAsString)
		transport := objectUnderTest.Transport()
		proxyFunc := objectUnderTest.UpstreamProxy()

		assert.NotNil(t, proxyFunc)
		actualUrl, err := proxyFunc(&testRequest)
		assert.Nil(t, err)
		assert.Equal(t, expectedUpstreamProxyUrl, actualUrl)

		// check transport and thereby authenticator configuration
		if httpauth.IsSupportedMechanism(currentMechanism) {
			assert.NotNil(t, transport.DialContext)
			assert.Nil(t, transport.Proxy)
		} else {
			assert.Nil(t, transport.DialContext)
			assert.NotNil(t, transport.Proxy)
		}
	}
}
