package httpauth

import (
	"context"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/snyk/cli/cliv2/internal/httpauth/test/helper"
	"github.com/stretchr/testify/assert"
)

//go:generate $GOPATH/bin/mockgen -source=httpauth.go -destination ./httpauth_generated_mock.go -package httpauth -self_package github.com/snyk/cli/cliv2/internal/httpauth

func createMockServer() (*helper.MockServer, net.Conn) {
	// prepare test data
	mockServer := helper.NewMockServer()
	go mockServer.Listen()

	connection, _ := net.Dial("tcp", ":"+fmt.Sprint(mockServer.Port))

	return mockServer, connection
}

func helper_processResponse407(t *testing.T, success bool, mechanism AuthenticationMechanism, expectedToken string, response *http.Response) {
	// prepare test environment
	authenticator := NewProxyAuthenticator(mechanism, nil, testLogger)
	authHandler := NewHandler(authenticator.acceptedProxyAuthMechanism)

	// run method under test
	token, err := authenticator.processResponse407(authHandler, response)

	// check expectations
	assert.Equal(t, expectedToken, token)

	if success {
		assert.Nil(t, err)
	} else {
		assert.NotNil(t, err)
	}
}

func helper_processResponse(t *testing.T, success bool, mechanism AuthenticationMechanism, expectedToken string, response *http.Response, responseError error) AuthenticationHandlerInterface {
	// prepare test environment
	authenticator := NewProxyAuthenticator(mechanism, nil, testLogger)
	authHandler := NewHandler(authenticator.acceptedProxyAuthMechanism)

	// run method under test
	token, err := authenticator.processResponse(authHandler, response, responseError)

	// check expectations
	assert.Equal(t, expectedToken, token)

	if success {
		assert.Nil(t, err)
	} else {
		assert.NotNil(t, err)
	}
	return authHandler
}

func helper_DialContext(t *testing.T, success bool, applyExpectations func(*MockAuthenticationHandlerInterface), mechanism AuthenticationMechanism, proxyFunc func(*http.Request) (*url.URL, error), target string) {
	context := context.Background()

	ctrl := gomock.NewController(t)
	mockedAuthenticationHandler := NewMockAuthenticationHandlerInterface(ctrl)

	// prepare test environment
	authenticator := NewProxyAuthenticator(mechanism, proxyFunc, testLogger)
	authenticator.CreateHandler = func(mechanism AuthenticationMechanism) AuthenticationHandlerInterface {
		return mockedAuthenticationHandler
	}

	if applyExpectations != nil {
		applyExpectations(mockedAuthenticationHandler)
	}

	// run method under test
	connection, err := authenticator.DialContext(context, "tcp", target)

	// check expectations
	if success {
		assert.Nil(t, err)
		assert.NotNil(t, connection)
	} else {
		assert.NotNil(t, err)
		assert.Nil(t, connection)
	}
}

func Test_ProxyAuthenticator_processResponse407_fail01(t *testing.T) {
	// prepare test data
	mechanism := Negotiate
	expectedToken := ""
	response := &http.Response{}

	helper_processResponse407(t, false, mechanism, expectedToken, response)
}

func Test_ProxyAuthenticator_processResponse407_fail02(t *testing.T) {
	// prepare test data
	mechanism := Negotiate
	expectedToken := ""
	response := &http.Response{
		Header: http.Header{},
	}
	response.Header.Add(ProxyAuthenticateKey, "NTLM TlRMTVNTUAACAAAADgAOADgAAAAVgoni/Fy06M1ZvVQAAAAAAAAAAKQApABGAAAABgEAAAAAAA9IAEEATQBNAEUAUgAyAAIADgBIAEEATQBNAEUAUgAyAAEAHABFAEMAMgBBAE0AQQBaAC0AVgBVAEgATABOAFEABAAeAGgAYQBtAG0AZQByADIALgBzAG4AeQBrAC4AaQBvAAMAPABlAGMAMgBhAG0AYQB6AC0AdgB1AGgAbABuAHEALgBoAGEAbQBtAGUAcgAyAC4AcwBuAHkAawAuAGkAbwAHAAgAli6vQTKY2AEAAAAA")

	helper_processResponse407(t, false, mechanism, expectedToken, response)
}

func Test_ProxyAuthenticator_processResponse407_fail03(t *testing.T) {
	// prepare test data
	mechanism := Negotiate
	expectedToken := ""
	response := &http.Response{
		Header: http.Header{},
	}
	response.Header.Add(ProxyAuthenticateKey, "") // empty value

	helper_processResponse407(t, false, mechanism, expectedToken, response)
}

func Test_ProxyAuthenticator_processResponse407_success(t *testing.T) {
	// prepare test data
	mechanism := Negotiate
	expectedToken := "TlRMTVNTUAACAAAADgAOADgAAAAVgoni/Fy06M1ZvVQAAAAAAAAAAKQApABGAAAABgEAAAAAAA9IAEEATQBNAEUAUgAyAAIADgBIAEEATQBNAEUAUgAyAAEAHABFAEMAMgBBAE0AQQBaAC0AVgBVAEgATABOAFEABAAeAGgAYQBtAG0AZQByADIALgBzAG4AeQBrAC4AaQBvAAMAPABlAGMAMgBhAG0AYQB6AC0AdgB1AGgAbABuAHEALgBoAGEAbQBtAGUAcgAyAC4AcwBuAHkAawAuAGkAbwAHAAgAli6vQTKY2AEAAAAA"
	response := &http.Response{
		Header: http.Header{},
	}
	response.Header.Add(ProxyAuthenticateKey, "Negotiate "+expectedToken)

	helper_processResponse407(t, true, mechanism, expectedToken, response)
}

func Test_ProxyAuthenticator_processResponse407_success02(t *testing.T) {
	// prepare test data
	mechanism := Negotiate
	expectedToken := "something"
	response := &http.Response{
		Header: http.Header{},
	}

	response.Header.Add(ProxyAuthenticateKey, "NTLM")
	response.Header.Add(ProxyAuthenticateKey, "NEGOTIATE "+expectedToken)

	helper_processResponse407(t, true, mechanism, expectedToken, response)
}

func Test_ProxyAuthenticator_processResponse_fail01(t *testing.T) {
	// prepare test data
	mechanism := Negotiate
	expectedToken := ""
	responseError := fmt.Errorf("Some downstream error occured!")
	response := &http.Response{
		Header: http.Header{},
	}
	response.Header.Add(ProxyAuthenticateKey, "Negotiate ")

	helper_processResponse(t, false, mechanism, expectedToken, response, responseError)
}

func Test_ProxyAuthenticator_processResponse_fail02(t *testing.T) {
	// prepare test data
	mechanism := Negotiate
	expectedToken := ""
	responseError := error(nil)
	response := &http.Response{
		StatusCode: 500, // unexpected StatusCode
		Header:     http.Header{},
	}

	helper_processResponse(t, false, mechanism, expectedToken, response, responseError)
}

func Test_ProxyAuthenticator_processResponse_fail03(t *testing.T) {
	// prepare test data
	mechanism := Negotiate
	expectedToken := ""
	responseError := error(nil)
	var response *http.Response = nil // response is nil

	helper_processResponse(t, false, mechanism, expectedToken, response, responseError)
}

func Test_ProxyAuthenticator_processResponse_success407(t *testing.T) {
	// prepare test data
	mechanism := Negotiate
	expectedToken := "TlRMTVNTUAACAAAADgAOADgAAAAVgoni/Fy06M1ZvVQAAAAAAAAAAKQApABGAAAABgEAAAAAAA9IAEEATQBNAEUAUgAyAAIADgBIAEEATQBNAEUAUgAyAAEAHABFAEMAMgBBAE0AQQBaAC0AVgBVAEgATABOAFEABAAeAGgAYQBtAG0AZQByADIALgBzAG4AeQBrAC4AaQBvAAMAPABlAGMAMgBhAG0AYQB6AC0AdgB1AGgAbABuAHEALgBoAGEAbQBtAGUAcgAyAC4AcwBuAHkAawAuAGkAbwAHAAgAli6vQTKY2AEAAAAA"
	responseError := error(nil)
	response := &http.Response{
		StatusCode: 407,
		Header:     http.Header{},
	}
	response.Header.Add(ProxyAuthenticateKey, "Negotiate "+expectedToken)

	authHandler := helper_processResponse(t, true, mechanism, expectedToken, response, responseError)
	assert.False(t, authHandler.IsStopped())
}

func Test_ProxyAuthenticator_processResponse_success200(t *testing.T) {
	// prepare test data
	mechanism := Negotiate
	expectedToken := ""
	responseError := error(nil)
	response := &http.Response{
		StatusCode: 200,
	}

	authHandler := helper_processResponse(t, true, mechanism, expectedToken, response, responseError)
	assert.True(t, authHandler.IsStopped())
}

func Test_ProxyAuthenticator_connectToProxy_fail01(t *testing.T) {
	// prepare test data
	context := context.Background()
	mechanism := Negotiate
	proxyUrl := &url.URL{}
	target := ""
	var createConnectionFunc func() (net.Conn, error) = nil // shouldn't be nil

	// prepare test environment
	authenticator := NewProxyAuthenticator(mechanism, nil, testLogger)

	// run method under test
	connection, err := authenticator.connectToProxy(context, proxyUrl, target, createConnectionFunc)

	// check expectations
	assert.NotNil(t, err)
	assert.Nil(t, connection)
}

func Test_ProxyAuthenticator_connectToProxy_fail02(t *testing.T) {
	// prepare test data
	context := context.Background()
	mechanism := Negotiate
	proxyUrl := &url.URL{Opaque: "https://snyk.io"}
	target := "" // shouldn't be empty
	createConnectionFunc := func() (net.Conn, error) { return nil, nil }

	// prepare test environment
	authenticator := NewProxyAuthenticator(mechanism, nil, testLogger)

	// run method under test
	connection, err := authenticator.connectToProxy(context, proxyUrl, target, createConnectionFunc)

	// check expectations
	assert.NotNil(t, err)
	assert.Nil(t, connection)
}

func Test_ProxyAuthenticator_connectToProxy_fail03(t *testing.T) {
	// prepare test data
	context := context.Background()
	mechanism := Negotiate
	var proxyUrl *url.URL = nil // shouldn't be nil
	target := "snyk.io:443"
	createConnectionFunc := func() (net.Conn, error) { return nil, nil }

	// prepare test environment
	authenticator := NewProxyAuthenticator(mechanism, nil, testLogger)

	// run method under test
	connection, err := authenticator.connectToProxy(context, proxyUrl, target, createConnectionFunc)

	// check expectations
	assert.NotNil(t, err)
	assert.Nil(t, connection)
}

func Test_ProxyAuthenticator_connectToProxy_fail04(t *testing.T) {
	mockServer, masterConnection := createMockServer()

	// prepare test data
	mockServer.ResponseList = append(mockServer.ResponseList, &http.Response{StatusCode: 407, Header: http.Header{ProxyAuthenticateKey: []string{"Negotiate 123456789"}}})
	mockServer.ResponseList = append(mockServer.ResponseList, &http.Response{StatusCode: 200})

	context := context.Background()
	mechanism := Negotiate
	proxyUrl := &url.URL{Opaque: "http://127.0.0.1:3128"}
	target := "snyk.io:443"
	createConnectionFunc := func() (net.Conn, error) { return masterConnection, nil }

	ctrl := gomock.NewController(t)
	mockedAuthenticationHandler := NewMockAuthenticationHandlerInterface(ctrl)

	mockedAuthenticationHandler.EXPECT().IsStopped().Return(false).Times(len(mockServer.ResponseList))
	mockedAuthenticationHandler.EXPECT().IsStopped().Return(true).Times(1)
	mockedAuthenticationHandler.EXPECT().GetAuthorizationValue(proxyUrl, "").Times(1).Return("Negotiate TlRMTVNTUAACAAAADgAOADgAAAAVgoni", nil)
	mockedAuthenticationHandler.EXPECT().Update(gomock.Any()).Times(1).Return("123456789", nil)
	mockedAuthenticationHandler.EXPECT().GetAuthorizationValue(proxyUrl, "123456789").Times(1).Return("", fmt.Errorf("Some library error!"))
	mockedAuthenticationHandler.EXPECT().Cancel().Times(1)
	mockedAuthenticationHandler.EXPECT().Close().Times(1)
	mockedAuthenticationHandler.EXPECT().SetLogger(testLogger).Times(1)

	// prepare test environment
	authenticator := NewProxyAuthenticator(mechanism, nil, testLogger)
	authenticator.CreateHandler = func(mechanism AuthenticationMechanism) AuthenticationHandlerInterface {
		return mockedAuthenticationHandler
	}

	// run method under test
	connection, err := authenticator.connectToProxy(context, proxyUrl, target, createConnectionFunc)

	// check expectations
	assert.NotNil(t, err)
	assert.Nil(t, connection)
}

func Test_ProxyAuthenticator_connectToProxy_success(t *testing.T) {
	mockServer, masterConnection := createMockServer()

	// prepare test data
	mockServer.ResponseList = append(mockServer.ResponseList, &http.Response{StatusCode: 407, Header: http.Header{ProxyAuthenticateKey: []string{"Negotiate 123456789"}}})
	mockServer.ResponseList = append(mockServer.ResponseList, &http.Response{StatusCode: 407, Header: http.Header{ProxyAuthenticateKey: []string{"Negotiate 10111213141516171819"}}})
	mockServer.ResponseList = append(mockServer.ResponseList, &http.Response{StatusCode: 200})

	context := context.Background()
	mechanism := Negotiate
	proxyUrl := &url.URL{Opaque: "http://127.0.0.1:3128"}
	target := "snyk.io:443"
	createConnectionFunc := func() (net.Conn, error) { return masterConnection, nil }

	ctrl := gomock.NewController(t)
	mockedAuthenticationHandler := NewMockAuthenticationHandlerInterface(ctrl)

	mockedAuthenticationHandler.EXPECT().IsStopped().Return(false).Times(len(mockServer.ResponseList))
	mockedAuthenticationHandler.EXPECT().IsStopped().Return(true).Times(1)
	mockedAuthenticationHandler.EXPECT().GetAuthorizationValue(proxyUrl, "").Times(1).Return("Negotiate TlRMTVNTUAACAAAADgAOADgAAAAVgoni", nil)
	mockedAuthenticationHandler.EXPECT().Update(gomock.Any()).Times(1).Return("123456789", nil)
	mockedAuthenticationHandler.EXPECT().GetAuthorizationValue(proxyUrl, "123456789").Times(1).Return("Negotiate TlRMTVNTUAACAAAADgAOADgAAAAVgoni/Fy06M1ZvVQAAAAAAAAAAKQApABGAAAA", nil)
	mockedAuthenticationHandler.EXPECT().Update(gomock.Any()).Times(1).Return("10111213141516171819", nil)
	mockedAuthenticationHandler.EXPECT().GetAuthorizationValue(proxyUrl, "10111213141516171819").Times(1).Return("Negotiate TlRMTVNTUAACAAAADgAOADgAAAAVgoni/Fy06M1ZvVQAAAAAAAAAAKQApABGAAAABgEAAAAAAA9IAEEATQBNAEUAUgAyAAIADgBIAEEATQBNAEUAUgAyAAEAHABFAEMAMgBBAE0AQQBaAC0AVgBVAEgATABOAFEABAAeAGgAYQBtAG0AZQByADIALgBzAG4AeQBrAC4AaQBvAAMAPABlAGMAMgBhAG0AYQB6AC0AdgB1AGgAbABuAHEALgBoAGEAbQBtAGUAcgAyAC4AcwBuAHkAawAuAGkAbwAHAAgAli6vQTKY2AEAAAAA", nil)
	mockedAuthenticationHandler.EXPECT().Succesful().Times(1)
	mockedAuthenticationHandler.EXPECT().Close().Times(1)
	mockedAuthenticationHandler.EXPECT().SetLogger(testLogger).Times(1)

	// prepare test environment
	authenticator := NewProxyAuthenticator(mechanism, nil, testLogger)
	authenticator.CreateHandler = func(mechanism AuthenticationMechanism) AuthenticationHandlerInterface {
		return mockedAuthenticationHandler
	}

	// run method under test
	connection, err := authenticator.connectToProxy(context, proxyUrl, target, createConnectionFunc)

	// check expectations
	assert.Nil(t, err)
	assert.NotNil(t, connection)
}

func Test_ProxyAuthenticator_DialContext_fail01(t *testing.T) {
	mechanism := Negotiate
	proxyUrl, _ := url.Parse("http://localhost:12") // used random not existing port
	target := "snyk.io:443"
	proxyFunc := func(*http.Request) (*url.URL, error) { return proxyUrl, nil }

	expectations := func(mockedAuthenticationHandler *MockAuthenticationHandlerInterface) {
		mockedAuthenticationHandler.EXPECT().IsStopped().Return(false).Times(1)
		mockedAuthenticationHandler.EXPECT().IsStopped().Return(true).Times(1)
		mockedAuthenticationHandler.EXPECT().GetAuthorizationValue(proxyUrl, "").Times(1).Return("Negotiate TlRMTVNTUAACAAAADgAOADgAAAAVgoni", nil)
		mockedAuthenticationHandler.EXPECT().Cancel().Times(1)
		mockedAuthenticationHandler.EXPECT().Close().Times(1)
		mockedAuthenticationHandler.EXPECT().SetLogger(testLogger).Times(1)
	}

	helper_DialContext(t, false, expectations, mechanism, proxyFunc, target)
}

func Test_ProxyAuthenticator_DialContext_fail02(t *testing.T) {
	mechanism := Negotiate
	proxyUrl, _ := url.Parse("http://localhost:123")
	target := "snyk.io:7831" // used random not existing port which will not find an appropriate proxy
	proxyFunc := func(*http.Request) (*url.URL, error) { return proxyUrl, nil }

	expectations := func(mockedAuthenticationHandler *MockAuthenticationHandlerInterface) {
		mockedAuthenticationHandler.EXPECT().IsStopped().Return(false).Times(1)
		mockedAuthenticationHandler.EXPECT().IsStopped().Return(true).Times(1)
		mockedAuthenticationHandler.EXPECT().GetAuthorizationValue(proxyUrl, "").Times(1).Return("Negotiate TlRMTVNTUAACAAAADgAOADgAAAAVgoni", nil)
		mockedAuthenticationHandler.EXPECT().Cancel().Times(1)
		mockedAuthenticationHandler.EXPECT().Close().Times(1)
		mockedAuthenticationHandler.EXPECT().SetLogger(testLogger).Times(1)
	}

	helper_DialContext(t, false, expectations, mechanism, proxyFunc, target)
}

func Test_ProxyAuthenticator_DialContext_fail03(t *testing.T) {
	mechanism := Negotiate
	proxyUrl, _ := url.Parse("http://localhost:123")
	target := "snyk.io:443"
	proxyFunc := func(*http.Request) (*url.URL, error) { return proxyUrl, fmt.Errorf("Some random error") }

	helper_DialContext(t, false, nil, mechanism, proxyFunc, target)
}

// Test case: Negotiate enabled, proxy address specified, doing 3 message authentication similar to NTLM (using spnego provider mock)
func Test_ProxyAuthenticator_DialContext_success(t *testing.T) {
	mockServer, _ := createMockServer()

	// prepare test data
	mockServer.ResponseList = append(mockServer.ResponseList, &http.Response{StatusCode: 407, Header: http.Header{ProxyAuthenticateKey: []string{"Negotiate " + NTML_02_CHALLENGE}}})
	mockServer.ResponseList = append(mockServer.ResponseList, &http.Response{StatusCode: 200})

	mechanism := Negotiate
	proxyUrl, _ := url.Parse("http://localhost:" + fmt.Sprint(mockServer.Port))
	target := "snyk.io:443"
	proxyFunc := func(*http.Request) (*url.URL, error) { return proxyUrl, nil }

	spnegoProviderMock := NewMockSpnegoProvider(gomock.NewController(t))
	defer spnegoProviderMock.ctrl.Finish()
	spnegoProviderMock.EXPECT().GetToken(proxyUrl, "").Times(1).Return(NTML_01_INITIALMESSAGE, false, nil)
	spnegoProviderMock.EXPECT().GetToken(proxyUrl, NTML_02_CHALLENGE).Times(1).Return(NTML_03_RESPONSE, true, nil)
	spnegoProviderMock.EXPECT().SetLogger(testLogger)
	spnegoProviderMock.EXPECT().Close().Times(1)

	// prepare test environment
	authenticator := NewProxyAuthenticator(mechanism, proxyFunc, testLogger)
	authenticator.CreateHandler = func(mechanism AuthenticationMechanism) AuthenticationHandlerInterface {
		authHandler := NewHandler(mechanism)
		authHandler.SetSpnegoProvider(spnegoProviderMock)
		return authHandler
	}

	// run method under test
	connection, err := authenticator.DialContext(context.Background(), "tcp", target)

	// check expectations
	assert.Nil(t, err)
	assert.NotNil(t, connection)
}

// Test case: AnyAuth enabled, proxy address specified, doing 3 message authentication similar to NTLM (using spnego provider mock)
func Test_ProxyAuthenticator_DialContext_success02(t *testing.T) {
	mockServer, _ := createMockServer()

	// prepare test data
	mockServer.ResponseList = append(mockServer.ResponseList, &http.Response{StatusCode: 407, Header: http.Header{ProxyAuthenticateKey: []string{"NTLM", "Negotiate"}}})
	mockServer.ResponseList = append(mockServer.ResponseList, &http.Response{StatusCode: 407, Header: http.Header{ProxyAuthenticateKey: []string{"Negotiate " + NTML_02_CHALLENGE}}})
	mockServer.ResponseList = append(mockServer.ResponseList, &http.Response{StatusCode: 200})

	mechanism := AnyAuth
	proxyUrl, _ := url.Parse("http://localhost:" + fmt.Sprint(mockServer.Port))
	target := "snyk.io:443"
	proxyFunc := func(*http.Request) (*url.URL, error) { return proxyUrl, nil }

	spnegoProviderMock := NewMockSpnegoProvider(gomock.NewController(t))
	defer spnegoProviderMock.ctrl.Finish()
	spnegoProviderMock.EXPECT().GetToken(proxyUrl, "").Times(1).Return(NTML_01_INITIALMESSAGE, false, nil)
	spnegoProviderMock.EXPECT().GetToken(proxyUrl, NTML_02_CHALLENGE).Times(1).Return(NTML_03_RESPONSE, true, nil)
	spnegoProviderMock.EXPECT().SetLogger(testLogger)
	spnegoProviderMock.EXPECT().Close().Times(1)

	// prepare test environment
	authenticator := NewProxyAuthenticator(mechanism, proxyFunc, testLogger)
	authenticator.CreateHandler = func(mechanism AuthenticationMechanism) AuthenticationHandlerInterface {
		authHandler := NewHandler(mechanism)
		authHandler.SetSpnegoProvider(spnegoProviderMock)
		return authHandler
	}

	// run method under test
	connection, err := authenticator.DialContext(context.Background(), "tcp", target)

	// check expectations
	assert.Nil(t, err)
	assert.NotNil(t, connection)
}

// Test case: AnyAuth enabled, NO proxy address specified, normal connection will be established (using spnego provider mock)
func Test_ProxyAuthenticator_DialContext_success03(t *testing.T) {
	mechanism := AnyAuth
	target := "snyk.io:443"
	var proxyFunc func(*http.Request) (*url.URL, error) // no proxy configured should just return the tcp connection

	helper_DialContext(t, true, nil, mechanism, proxyFunc, target)
}

// Test case: AnyAuth enabled, proxy address specified, proxy doesn't require authentication (using spnego provider mock)
func Test_ProxyAuthenticator_DialContext_success04(t *testing.T) {
	mockServer, _ := createMockServer()

	// prepare test data
	mockServer.ResponseList = append(mockServer.ResponseList, &http.Response{StatusCode: 200})

	mechanism := AnyAuth
	proxyUrl, _ := url.Parse("http://localhost:" + fmt.Sprint(mockServer.Port))
	target := "snyk.io:443"
	proxyFunc := func(*http.Request) (*url.URL, error) { return proxyUrl, nil }

	spnegoProviderMock := NewMockSpnegoProvider(gomock.NewController(t))
	defer spnegoProviderMock.ctrl.Finish()
	spnegoProviderMock.EXPECT().SetLogger(testLogger)
	spnegoProviderMock.EXPECT().Close().Times(1)

	// prepare test environment
	authenticator := NewProxyAuthenticator(mechanism, proxyFunc, testLogger)
	authenticator.CreateHandler = func(mechanism AuthenticationMechanism) AuthenticationHandlerInterface {
		authHandler := NewHandler(mechanism)
		authHandler.SetSpnegoProvider(spnegoProviderMock)
		return authHandler
	}

	// run method under test
	connection, err := authenticator.DialContext(context.Background(), "tcp", target)

	// check expectations
	assert.Nil(t, err)
	assert.NotNil(t, connection)
}
