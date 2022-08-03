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
	httpServer          *http.Server
	DebugLogger         *log.Logger
	CertificateLocation string
	upstreamProxy       func(*http.Request) (*url.URL, error)
	transport           *http.Transport
	authenticator       *httpauth.ProxyAuthenticator
	port                int
	authMechanism       httpauth.AuthenticationMechanism
	cliVersion          string
}

func NewWrapperProxy(insecureSkipVerify bool, cacheDirectory string, cliVersion string, debugLogger *log.Logger) (*WrapperProxy, error) {
	var p WrapperProxy
	p.DebugLogger = debugLogger
	p.cliVersion = cliVersion

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

	p.transport = &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: insecureSkipVerify, // goproxy defaults to true
		},
	}

	p.SetUpstreamProxy(http.ProxyFromEnvironment)

	return &p, nil
}

func (p *WrapperProxy) replaceVersionHandler(r *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
	// Manipulate Header (replace x-snyk-cli-version)
	existingValue := r.Header.Get("x-snyk-cli-version")
	if existingValue != "" {
		p.DebugLogger.Printf("Replacing value of existing x-snyk-cli-version header (%s) with %s\n", existingValue, p.cliVersion)
		r.Header.Set("x-snyk-cli-version", p.cliVersion)
	}
	return r, nil
}

func (p *WrapperProxy) Start() (int, error) {
	proxy := goproxy.NewProxyHttpServer()
	proxy.Tr = p.transport
	proxy.Logger = p.DebugLogger
	proxy.OnRequest().HandleConnect(goproxy.AlwaysMitm)
	proxy.OnRequest().DoFunc(p.replaceVersionHandler)

	proxy.Verbose = true
	proxyServer := &http.Server{
		Handler: proxy,
	}

	p.httpServer = proxyServer

	p.DebugLogger.Println("starting proxy")
	address := "127.0.0.1:0"
	l, err := net.Listen("tcp", address)
	if err != nil {
		return 0, err
	}

	p.port = l.Addr().(*net.TCPAddr).Port
	p.DebugLogger.Println("Wrapper proxy is listening on port: ", p.port)

	go func() {
		_ = p.httpServer.Serve(l) // this blocks until the server stops and gives you an error which can be ignored
	}()

	return p.port, nil
}

func (p *WrapperProxy) Stop() {
	err := p.httpServer.Shutdown(context.Background())
	if err == nil {
		p.DebugLogger.Printf("Proxy successfully shut down")
	} else {
		// Error from closing listeners, or context timeout:
		p.DebugLogger.Printf("HTTP server Shutdown error: %v", err)
	}
}

func (p *WrapperProxy) Close() {
	p.Stop()

	p.DebugLogger.Println("deleting temp cert file:", p.CertificateLocation)
	err := os.Remove(p.CertificateLocation)
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
	if mechanism != p.authMechanism {
		p.authMechanism = mechanism
		p.DebugLogger.Printf("Enabled Proxy Authentication Mechanism: %s\n", httpauth.StringFromAuthenticationMechanism(p.authMechanism))
	}

	if httpauth.IsSupportedMechanism(p.authMechanism) { // since Negotiate is not covered by the go http stack, we skip its proxy handling and inject a custom Handling via the DialContext
		p.authenticator = httpauth.NewProxyAuthenticator(p.authMechanism, p.upstreamProxy, p.DebugLogger)
		p.transport.DialContext = p.authenticator.DialContext
		p.transport.Proxy = nil
	} else { // for other mechanisms like basic we switch back to go default behavior
		p.transport.DialContext = nil
		p.transport.Proxy = p.upstreamProxy
		p.authenticator = nil
	}
}

func (p *WrapperProxy) SetUpstreamProxyFromUrl(proxyAddr string) {
	if len(proxyAddr) > 0 {
		if proxyUrl, err := url.Parse(proxyAddr); err == nil {
			p.SetUpstreamProxy(func(req *http.Request) (*url.URL, error) {
				return proxyUrl, nil
			})
		} else {
			fmt.Println("Failed to set proxy! ", err)
		}
	}
}

func (p *WrapperProxy) SetUpstreamProxy(proxyFunc func(req *http.Request) (*url.URL, error)) {
	p.upstreamProxy = proxyFunc
	p.SetUpstreamProxyAuthentication(p.authMechanism)
}

func (p *WrapperProxy) UpstreamProxy() func(req *http.Request) (*url.URL, error) {
	return p.upstreamProxy
}

func (p *WrapperProxy) Port() int {
	return p.port
}

func (p *WrapperProxy) Transport() *http.Transport {
	return p.transport
}
