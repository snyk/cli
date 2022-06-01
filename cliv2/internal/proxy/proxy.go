package proxy

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"

	"github.com/snyk/cli/cliv2/internal/certs"
	"github.com/snyk/cli/cliv2/internal/httpauth"
	"github.com/snyk/cli/cliv2/internal/utils"

	"github.com/elazarl/goproxy"
)

type WrapperProxy struct {
	impl                       *goproxy.ProxyHttpServer
	httpServer                 *http.Server
	DebugLogger                *log.Logger
	CertificateLocation        string
	acceptedProxyAuthMechanism httpauth.AuthenticationMechanism
}

func NewWrapperProxy(insecureSkipVerify bool, cacheDirectory string, cliVersion string, debugLogger *log.Logger) (*WrapperProxy, error) {
	var p WrapperProxy
	p.DebugLogger = debugLogger
	p.acceptedProxyAuthMechanism = httpauth.NoAuth

	certName := "snyk-embedded-proxy"
	certPEMBlock, keyPEMBlock, err := certs.MakeSelfSignedCert(certName, []string{}, p.DebugLogger)
	if err != nil {
		return nil, err
	}

	tempDir, err := utils.SnykTempDirectory(p.DebugLogger)
	if err != nil {
		p.DebugLogger.Println("failed to create system temp directory:", tempDir)
		return nil, err
	}

	certFile, err := os.CreateTemp(tempDir, "snyk-cli-cert-*.crt")
	if err != nil {
		fmt.Println("failed to create temp cert file")
		return nil, err
	}
	defer certFile.Close()

	p.CertificateLocation = certFile.Name() // gives full path, not just the name
	p.DebugLogger.Println("p.CertificateLocation:", p.CertificateLocation)

	certPEMString := string(certPEMBlock)
	err = utils.WriteToFile(p.CertificateLocation, certPEMString)
	if err != nil {
		fmt.Println("failed to write cert to file")
		return nil, err
	}

	err = setCAFromBytes(certPEMBlock, keyPEMBlock)
	if err != nil {
		return nil, err
	}

	proxy := goproxy.NewProxyHttpServer()
	proxy.Tr = &http.Transport{
		Proxy:                 http.ProxyFromEnvironment,
		GetProxyConnectHeader: p.GetProxyConnectHeader,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: insecureSkipVerify, // goproxy defaults to true
		},
	}

	proxy.Logger = debugLogger
	proxy.OnRequest().HandleConnect(goproxy.AlwaysMitm)
	proxy.OnRequest().DoFunc(func(r *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response) {

		// Manipulate Header (replace x-snyk-cli-version)
		existingValue := r.Header.Get("x-snyk-cli-version")
		if existingValue != "" {
			debugLogger.Printf("Replacing value of existing x-snyk-cli-version header (%s) with %s\n", existingValue, cliVersion)
			r.Header.Set("x-snyk-cli-version", cliVersion)
		}

		return r, nil
	})

	proxy.Verbose = true
	proxyServer := &http.Server{
		Handler: proxy,
	}

	p.httpServer = proxyServer
	p.impl = proxy

	return &p, nil
}

func (p *WrapperProxy) Start() (int, error) {
	p.DebugLogger.Println("starting proxy")
	address := "127.0.0.1:0"
	l, err := net.Listen("tcp", address)
	if err != nil {
		return 0, err
	}

	port := l.Addr().(*net.TCPAddr).Port
	p.DebugLogger.Println("Wrapper proxy is listening on port: ", port)

	go func() {
		_ = p.httpServer.Serve(l) // this blocks until the server stops and gives you an error which can be ignored
	}()

	return port, nil
}

func (p *WrapperProxy) Close() {
	err := p.httpServer.Shutdown(context.Background())
	if err == nil {
		p.DebugLogger.Printf("Proxy successfully shut down")
	} else {
		// Error from closing listeners, or context timeout:
		p.DebugLogger.Printf("HTTP server Shutdown error: %v", err)
	}

	p.DebugLogger.Println("deleting temp cert file:", p.CertificateLocation)
	err = os.Remove(p.CertificateLocation)
	if err != nil {
		p.DebugLogger.Println("failed to delete cert file")
		p.DebugLogger.Println(err)
	} else {
		p.DebugLogger.Println("deleted temp cert file:", p.CertificateLocation)
	}
}

func setCAFromBytes(certPEMBlock []byte, keyPEMBlock []byte) error {
	goproxyCa, err := tls.X509KeyPair(certPEMBlock, keyPEMBlock)
	if err != nil {
		return err
	}
	if goproxyCa.Leaf, err = x509.ParseCertificate(goproxyCa.Certificate[0]); err != nil {
		return err
	}
	goproxy.GoproxyCa = goproxyCa
	goproxy.OkConnect = &goproxy.ConnectAction{Action: goproxy.ConnectAccept, TLSConfig: goproxy.TLSConfigFromCA(&goproxyCa)}
	goproxy.MitmConnect = &goproxy.ConnectAction{Action: goproxy.ConnectMitm, TLSConfig: goproxy.TLSConfigFromCA(&goproxyCa)}
	goproxy.HTTPMitmConnect = &goproxy.ConnectAction{Action: goproxy.ConnectHTTPMitm, TLSConfig: goproxy.TLSConfigFromCA(&goproxyCa)}
	goproxy.RejectConnect = &goproxy.ConnectAction{Action: goproxy.ConnectReject, TLSConfig: goproxy.TLSConfigFromCA(&goproxyCa)}
	return nil
}

func (p *WrapperProxy) SetUpstreamProxyAuthentication(mechanism httpauth.AuthenticationMechanism) {
	p.acceptedProxyAuthMechanism = mechanism
	p.DebugLogger.Println("Proxy Authentication Mechanism:", httpauth.StringFromAuthenticationMechanism(p.acceptedProxyAuthMechanism))
}

func (p *WrapperProxy) SetUpstreamProxy(proxyAddr string) {
	if len(proxyAddr) > 0 {
		if proxyUrl, err := url.Parse(proxyAddr); err == nil {
			p.impl.Tr.Proxy = func(req *http.Request) (*url.URL, error) {
				return proxyUrl, nil
			}
			p.DebugLogger.Println("Proxy Address:", proxyUrl)
		} else {
			fmt.Println("Failed to set proxy! ", err)
		}
	}
}

func (p *WrapperProxy) GetUpstreamProxy() func(req *http.Request) (*url.URL, error) {
	return p.impl.Tr.Proxy
}

func (p *WrapperProxy) GetProxyConnectHeader(ctx context.Context, proxyURL *url.URL, target string) (http.Header, error) {

	var err error
	var token string
	proxyConnectHeader := make(http.Header)

	if p.acceptedProxyAuthMechanism != httpauth.NoAuth {
		if proxyURL != nil {
			// create an AuthenticationHandler
			authHandler := httpauth.AuthenticationHandler{
				Mechanism: p.acceptedProxyAuthMechanism,
			}

			// try to retrieve Header value
			if token, err = authHandler.GetAuthorizationValue(proxyURL); err == nil {
				if len(token) > 0 {
					proxyConnectHeader.Add(httpauth.ProxyAuthorizationKey, token)
					p.DebugLogger.Printf("CONNECT Header value \"%s\" added.\n", httpauth.ProxyAuthorizationKey)
				} else {
					p.DebugLogger.Printf("CONNECT Header value \"%s\" NOT added since it is empty.\n", httpauth.ProxyAuthorizationKey)
				}
			} else {
				fmt.Println("Failed to retreive Proxy Authorization!", err)
			}
		} else {
			err = fmt.Errorf("Given proxyUrl must not be nil!")
		}
	}

	return proxyConnectHeader, err
}
