package httpauth

import (
	"bufio"
	"context"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"strings"
	"time"

	"golang.org/x/net/idna"
)

type ProxyAuthenticator struct {
	acceptedProxyAuthMechanism AuthenticationMechanism
	debugLogger                *log.Logger
	upstreamProxy              func(*http.Request) (*url.URL, error)
}

func NewProxyAuthenticator(mechanism AuthenticationMechanism, upstreamProxy func(*http.Request) (*url.URL, error), logger *log.Logger) *ProxyAuthenticator {
	authenticator := &ProxyAuthenticator{
		acceptedProxyAuthMechanism: mechanism,
		debugLogger:                logger,
		upstreamProxy:              upstreamProxy,
	}
	return authenticator
}

// This is the main entry point function for the ProxyAuthenticator when being used with http.Transport.
// It should be used like this: transport.DialContext = DialContext
// It'll be invoked by http.Transport when it requires a new TCP connection.
func (p *ProxyAuthenticator) DialContext(ctx context.Context, network, addr string) (net.Conn, error) {
	var connection net.Conn
	var err error
	var proxyUrl *url.URL

	fakeRequest := &http.Request{URL: &url.URL{}}
	fakeRequest.URL.Scheme = LookupSchemeFromCannonicalAddress(addr, "https")
	proxyUrl, err = p.upstreamProxy(fakeRequest)
	if err != nil {
		return nil, err
	}

	if proxyUrl != nil {
		proxyAddr := CanonicalAddr(proxyUrl)
		connection, err = net.Dial(network, proxyAddr)
		if err == nil {
			err = p.connectToProxy(ctx, proxyUrl, addr, connection)
		}

		if err != nil {
			fmt.Println("Failed to connect to Proxy! ", proxyUrl)
			if connection != nil {
				connection.Close()
				connection = nil
			}
		}
	} else {
		p.debugLogger.Println("No Proxy defined for ", addr, "!")
		connection, err = net.Dial(network, addr)
	}

	return connection, err
}

// This method takes the given connection and connects to the specified proxy (RFC 2817) while adding proxy authentication (RFC 4559).
func (p *ProxyAuthenticator) connectToProxy(ctx context.Context, proxyURL *url.URL, target string, connection net.Conn) error {

	var err error
	var token string
	var responseToken string

	if connection == nil {
		return fmt.Errorf("Given connection must not be nil!")
	}

	if proxyURL == nil {
		return fmt.Errorf("Given proxyUrl must not be nil!")
	}

	if len(target) == 0 {
		return fmt.Errorf("Given target address must not be empty!")
	}

	if p.acceptedProxyAuthMechanism != NoAuth {
		authHandler := NewHandler(p.acceptedProxyAuthMechanism)
		authHandler.SetLogger(p.debugLogger)
		defer authHandler.Close()

		p.debugLogger.Println("Proxy Address:", proxyURL)
		p.debugLogger.Printf("CONNECT to %s from %s via %s\n", target, connection.LocalAddr(), connection.RemoteAddr())

		for !authHandler.IsStopped() {
			proxyConnectHeader := make(http.Header)
			var response *http.Response
			var responseError error

			if token, err = authHandler.GetAuthorizationValue(proxyURL, responseToken); err == nil {
				if len(token) > 0 {
					proxyConnectHeader.Add(ProxyAuthorizationKey, token)
					p.debugLogger.Printf("> %s: %s\n", ProxyAuthorizationKey, token)

					mechanisms, _ := GetMechanismsFromToken(token)
					p.debugLogger.Printf("Mechanism: %s", mechanisms)
				}

				request := &http.Request{
					Method: "CONNECT",
					URL:    &url.URL{Opaque: target},
					Host:   target,
					Header: proxyConnectHeader,
				}

				response, responseError = p.SendRequest(ctx, connection, request)
				responseToken, err = p.processResponse(authHandler, response, responseError)

			} else {
				authHandler.Cancel()
				err = fmt.Errorf("Failed to retreive Proxy Authorization! %v", err)
			}
		}
	}

	return err
}

func (p *ProxyAuthenticator) processResponse(authHandler AuthenticationHandlerInterface, response *http.Response, responseError error) (responseToken string, err error) {
	if response != nil && response.StatusCode == 407 {
		responseToken, err = p.processResponse407(authHandler, response, responseError)
	} else if response != nil && response.StatusCode <= 200 && response.StatusCode <= 299 {
		authHandler.Succesful()
	} else if response != nil {
		authHandler.Cancel()
		err = fmt.Errorf("Unexpected HTTP Status Code %d", response.StatusCode)
	} else if responseError != nil {
		authHandler.Cancel()
		err = fmt.Errorf("Failed to CONNECT to proxy! %v", responseError)
	} else {
		authHandler.Cancel()
		err = fmt.Errorf("Failed to CONNECT to proxy due to unknown error!")
	}
	return responseToken, err
}

func (p *ProxyAuthenticator) processResponse407(authHandler AuthenticationHandlerInterface, response *http.Response, responseError error) (responseToken string, err error) {
	detectedMechanism := NoAuth

	result := response.Header.Values(ProxyAuthenticateKey)
	if len(result) == 1 {
		authenticateValue := strings.Split(result[0], " ")
		p.debugLogger.Printf("< %s: %s\n", ProxyAuthenticateKey, result[0])

		if len(authenticateValue) >= 1 {
			detectedMechanism = AuthenticationMechanismFromString(authenticateValue[0])
			p.debugLogger.Printf("  Detected Mechanism: %s\n", detectedMechanism)
		}

		if len(authenticateValue) == 2 {
			responseToken = authenticateValue[1]
			p.debugLogger.Printf("  Response Token: %s\n", responseToken)
		} else {
			responseToken = ""
		}

	} else {
		authHandler.Cancel()
		err = fmt.Errorf("Received 407 but didn't find \"%s\" in the header!", ProxyAuthenticateKey)
	}

	if detectedMechanism != p.acceptedProxyAuthMechanism {
		authHandler.Cancel()
		err = fmt.Errorf("Incorrect Mechanism detected! %s", result)
	}
	return responseToken, err
}

func (p *ProxyAuthenticator) GetMechanism() AuthenticationMechanism {
	return p.acceptedProxyAuthMechanism
}

func LookupSchemeFromCannonicalAddress(addr string, defaultScheme string) string {
	result := defaultScheme
	port := ""
	tempAddr := strings.Split(addr, ":")
	tempAddrLen := len(tempAddr)
	if tempAddrLen >= 2 {
		port = tempAddr[tempAddrLen-1]
	}

	for k, v := range portMap {
		if v == port {
			result = k
		}
	}
	return result
}

// the following code is partially taken and adapted from net/http/transport.go ----

// Copyright 2011 The Go Authors. All rights reserved.
// Use of this source code is governed by a BSD-style
// license that can be found in the LICENSE file.

// HTTP client implementation. See RFC 7230 through 7235.
//
// This is the low-level Transport implementation of RoundTripper.
// The high-level interface is in client.go.

func (p *ProxyAuthenticator) SendRequest(ctx context.Context, connection net.Conn, request *http.Request) (*http.Response, error) {

	// If there's no done channel (no deadline or cancellation
	// from the caller possible), at least set some (long)
	// timeout here. This will make sure we don't block forever
	// and leak a goroutine if the connection stops replying
	// after the TCP connect.
	connectCtx := ctx
	if ctx.Done() == nil {
		newCtx, cancel := context.WithTimeout(ctx, 1*time.Minute)
		defer cancel()
		connectCtx = newCtx
	}

	didReadResponse := make(chan struct{}) // closed after CONNECT write+read is done or fails
	var (
		resp *http.Response
		err  error // write or read error
	)
	// Write the CONNECT request & read the response.
	go func() {
		defer close(didReadResponse)
		err = request.Write(connection)
		if err != nil {
			return
		}
		// Okay to use and discard buffered reader here, because
		// TLS server will not speak until spoken to.
		br := bufio.NewReader(connection)
		resp, err = http.ReadResponse(br, request)
	}()
	select {
	case <-connectCtx.Done():
		connection.Close()
		<-didReadResponse
		return nil, connectCtx.Err()
	case <-didReadResponse:
		// resp or err now set
	}

	if resp != nil {
		resp.Body.Close()
	}

	return resp, err
}

var portMap = map[string]string{
	"http":   "80",
	"https":  "443",
	"socks5": "1080",
}

// CanonicalAddr returns url.Host but always with a ":port" suffix
func CanonicalAddr(url *url.URL) string {
	addr := url.Hostname()
	if v, err := idna.Lookup.ToASCII(addr); err == nil {
		addr = v
	}
	port := url.Port()
	if port == "" {
		port = portMap[url.Scheme]
	}
	return net.JoinHostPort(addr, port)
}
