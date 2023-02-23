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

	"github.com/google/uuid"

	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/internal/utils"
	"github.com/snyk/go-application-framework/pkg/networking/certs"
	"github.com/snyk/go-httpauth/pkg/httpauth"

	"github.com/elazarl/goproxy"
	"github.com/elazarl/goproxy/ext/auth"
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
	proxyUsername       string
	proxyPassword       string
	addHeaderFunc       func(*http.Request) error
}

type ProxyInfo struct {
	Port                int
	Password            string
	CertificateLocation string
}

const (
	PROXY_REALM    = "snykcli_realm"
	PROXY_USERNAME = "snykcli"
)

func NewWrapperProxy(insecureSkipVerify bool, cacheDirectory string, cliVersion string, debugLogger *log.Logger) (*WrapperProxy, error) {
	var p WrapperProxy
	p.DebugLogger = debugLogger
	p.cliVersion = cliVersion
	p.addHeaderFunc = func(request *http.Request) error { return nil }

	certName := "snyk-embedded-proxy"
	certPEMBlock, keyPEMBlock, err := certs.MakeSelfSignedCert(certName, []string{}, p.DebugLogger)
	if err != nil {
		return nil, err
	}

	tmpDirectory := utils.GetTemporaryDirectory(cacheDirectory, cliVersion)
	certFile, err := os.CreateTemp(tmpDirectory, "snyk-cli-cert-*.crt")
	if err != nil {
		fmt.Println("failed to create temp cert file")
		return nil, err
	}
	defer certFile.Close()

	p.CertificateLocation = certFile.Name() // gives full path, not just the name

	rootCAs, err := x509.SystemCertPool()
	if err != nil {
		return nil, err
	}

	// append any given extra CA certificate to the internal PEM data before storing it to file
	// this merges user provided CA certificates with the internal one
	if extraCaCertFile, ok := os.LookupEnv(constants.SNYK_CA_CERTIFICATE_LOCATION_ENV); ok {
		extraCertificateBytes, extraCertificateList, extraCertificateError := certs.GetExtraCaCert(extraCaCertFile)
		if extraCertificateError == nil {
			// add to pem data
			certPEMBlock = append(certPEMBlock, '\n')
			certPEMBlock = append(certPEMBlock, extraCertificateBytes...)

			// add to cert pool
			for _, currentCert := range extraCertificateList {
				if currentCert != nil {
					rootCAs.AddCert(currentCert)
				}
			}

			p.DebugLogger.Println("Using additional CAs from file: ", extraCaCertFile)
		}
	}

	p.DebugLogger.Println("Temporary CertificateLocation:", p.CertificateLocation)

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
			RootCAs:            rootCAs,
		},
	}

	p.SetUpstreamProxy(http.ProxyFromEnvironment)

	p.proxyUsername = PROXY_USERNAME
	p.proxyPassword = uuid.New().String()

	return &p, nil
}

func (p *WrapperProxy) ProxyInfo() *ProxyInfo {
	return &ProxyInfo{
		Port:                p.port,
		Password:            p.proxyPassword,
		CertificateLocation: p.CertificateLocation,
	}
}

func (p *WrapperProxy) replaceVersionHandler(r *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
	err := p.addHeaderFunc(r)
	if err != nil {
		p.DebugLogger.Printf("Failed to add header")
	}

	return r, nil
}

func (p *WrapperProxy) checkBasicCredentials(user, password string) bool {
	return user == p.proxyUsername && p.proxyPassword == password
}

func (p *WrapperProxy) HandleConnect(req string, ctx *goproxy.ProxyCtx) (*goproxy.ConnectAction, string) {
	basic := auth.BasicConnect("", p.checkBasicCredentials)
	action, str := basic.HandleConnect(req, ctx)
	p.DebugLogger.Println("HandleConnect - basic authentication result: ", action, str)

	if action == goproxy.OkConnect {
		action, str = goproxy.AlwaysMitm.HandleConnect(req, ctx)
	}

	return action, str
}

func (p *WrapperProxy) Start() error {
	proxy := goproxy.NewProxyHttpServer()
	proxy.Tr = p.transport
	proxy.Logger = p.DebugLogger
	proxy.OnRequest().DoFunc(p.replaceVersionHandler)
	proxy.OnRequest().HandleConnect(p)
	proxy.Verbose = true
	proxyServer := &http.Server{
		Handler: proxy,
	}

	p.httpServer = proxyServer

	p.DebugLogger.Println("starting proxy")
	address := "127.0.0.1:0"
	l, err := net.Listen("tcp", address)
	if err != nil {
		return err
	}

	p.port = l.Addr().(*net.TCPAddr).Port
	p.DebugLogger.Println("Wrapper proxy is listening on port: ", p.port)

	go func() {
		_ = p.httpServer.Serve(l) // this blocks until the server stops and gives you an error which can be ignored
	}()

	return nil
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

func (p *WrapperProxy) Transport() *http.Transport {
	return p.transport
}

func (p *WrapperProxy) SetHeaderFunction(addHeaderFunc func(*http.Request) error) {
	p.addHeaderFunc = addHeaderFunc
}
