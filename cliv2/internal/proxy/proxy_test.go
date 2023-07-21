package proxy_test

import (
	"crypto/tls"
	"crypto/x509"
	"encoding/base64"
	"fmt"
	"io/ioutil"
	"log"
	"net/http"
	"net/url"
	"os"
	"testing"

	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/internal/proxy"
	"github.com/snyk/cli/cliv2/internal/utils"
	"github.com/snyk/go-application-framework/pkg/networking/certs"
	"github.com/snyk/go-httpauth/pkg/httpauth"

	"github.com/stretchr/testify/assert"
)

var debugLogger *log.Logger = log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)

func helper_getHttpClient(gateway *proxy.WrapperProxy, useProxyAuth bool) (*http.Client, error) {
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

	var proxyUrl *url.URL
	proxyInfo := gateway.ProxyInfo()
	if useProxyAuth {
		proxyUrl, err = url.Parse(fmt.Sprintf("http://%s:%s@127.0.0.1:%d", proxy.PROXY_USERNAME, proxyInfo.Password, proxyInfo.Port))
	} else {
		proxyUrl, err = url.Parse(fmt.Sprintf("http://127.0.0.1:%d", proxyInfo.Port))
	}

	if err != nil {
		return nil, err
	}

	proxiedClient := &http.Client{Transport: &http.Transport{
		Proxy:           http.ProxyURL(proxyUrl),
		TLSClientConfig: config,
	}}

	return proxiedClient, nil
}

func setup(t *testing.T, baseCache string, version string) {
	err := utils.CreateAllDirectories(baseCache, version)
	assert.Nil(t, err)
}

func teardown(t *testing.T, baseCache string) {
	err := os.RemoveAll(baseCache)
	assert.Nil(t, err)
}

func Test_closingProxyDeletesTempCert(t *testing.T) {
	basecache := "testcache"
	version := "1.1.1"
	setup(t, basecache, version)
	defer teardown(t, basecache)

	wp, err := proxy.NewWrapperProxy(false, basecache, version, debugLogger)
	assert.Nil(t, err)

	err = wp.Start()
	t.Log("proxy port:", wp.ProxyInfo().Port)
	assert.Nil(t, err)

	wp.Close()

	// assert cert file is deleted
	_, err = os.Stat(wp.CertificateLocation)
	assert.NotNil(t, err) // this means the file is gone
}

func basicAuthValue(username string, password string) string {
	return base64.StdEncoding.EncodeToString([]byte(username + ":" + password))
}

func Test_canGoThroughProxy(t *testing.T) {
	basecache := "testcache"
	version := "1.1.1"
	setup(t, basecache, version)
	defer teardown(t, basecache)

	wp, err := proxy.NewWrapperProxy(false, basecache, version, debugLogger)
	assert.Nil(t, err)

	err = wp.Start()
	assert.Nil(t, err)

	useProxyAuth := true
	proxiedClient, err := helper_getHttpClient(wp, useProxyAuth)
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

func Test_proxyRejectsWithoutBasicAuthHeader(t *testing.T) {
	basecache := "testcache"
	version := "1.1.1"
	setup(t, basecache, version)
	defer teardown(t, basecache)

	wp, err := proxy.NewWrapperProxy(false, basecache, version, debugLogger)
	assert.Nil(t, err)

	err = wp.Start()
	assert.Nil(t, err)

	useProxyAuth := false
	proxiedClient, err := helper_getHttpClient(wp, useProxyAuth)
	assert.Nil(t, err)

	res, err := proxiedClient.Get("https://static.snyk.io/cli/latest/version")
	assert.Nil(t, res)
	assert.NotNil(t, err)
	assert.Contains(t, err.Error(), "Proxy Authentication Required")

	wp.Close()

	// assert cert file is deleted on Close
	_, err = os.Stat(wp.CertificateLocation)
	assert.NotNil(t, err) // this means the file is gone
}

func Test_SetUpstreamProxy(t *testing.T) {
	basecache := "testcache"
	version := "1.1.1"
	setup(t, basecache, version)
	defer teardown(t, basecache)

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

	objectUnderTest, err = proxy.NewWrapperProxy(false, basecache, version, debugLogger)
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

func Test_appendExtraCaCert(t *testing.T) {
	basecache := "testcache"
	version := "1.1.1"
	setup(t, basecache, version)
	defer teardown(t, basecache)

	certPem, _, _ := certs.MakeSelfSignedCert("mycert", []string{"dns"}, debugLogger)
	file, _ := os.CreateTemp("", "")
	file.Write(certPem)

	os.Setenv(constants.SNYK_CA_CERTIFICATE_LOCATION_ENV, file.Name())

	wp, err := proxy.NewWrapperProxy(false, basecache, version, debugLogger)
	assert.Nil(t, err)

	certsPem, err := os.ReadFile(wp.CertificateLocation)
	assert.Nil(t, err)

	certsList, err := certs.GetAllCerts(certsPem)
	assert.Nil(t, err)
	assert.Equal(t, 2, len(certsList))

	// cleanup
	os.Unsetenv(constants.SNYK_CA_CERTIFICATE_LOCATION_ENV)
	os.Remove(file.Name())
}
