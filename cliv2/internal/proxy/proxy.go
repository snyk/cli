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

	"github.com/snyk/cli/cliv2/internal/proxy/interceptor"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/networking/certs"
	pkg_utils "github.com/snyk/go-application-framework/pkg/utils"

	"github.com/snyk/go-httpauth/pkg/httpauth"

	"github.com/elazarl/goproxy"
	"github.com/elazarl/goproxy/ext/auth"

	"github.com/snyk/cli/cliv2/internal/constants"
	"github.com/snyk/cli/cliv2/internal/utils"
)

type WrapperProxy struct {
	httpServer          *http.Server
	DebugLogger         *zerolog.Logger
	CertificateLocation string
	upstreamProxy       func(*http.Request) (*url.URL, error)
	transport           *http.Transport
	authenticator       *httpauth.ProxyAuthenticator
	port                int
	authMechanism       httpauth.AuthenticationMechanism
	cliVersion          string
	proxyUsername       string
	proxyPassword       string
	config              configuration.Configuration
	interceptors        []interceptor.Interceptor
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

type CaData struct {
	CertPool *x509.CertPool
	CertFile string
	CertPem  string
}

func InitCA(config configuration.Configuration, cliVersion string, logger *zerolog.Logger) (*CaData, error) {
	cacheDirectory := config.GetString(configuration.CACHE_PATH)

	certName := "snyk-embedded-proxy"
	logWriter := pkg_utils.ToZeroLogDebug{Logger: logger}
	certPEMBlock, keyPEMBlock, err := certs.MakeSelfSignedCert(certName, []string{}, log.New(&logWriter, "", 0))
	if err != nil {
		return nil, err
	}

	tmpDirectory := config.GetString(configuration.TEMP_DIR_PATH)
	err = pkg_utils.CreateAllDirectories(cacheDirectory, cliVersion)
	if err != nil {
		return nil, err
	}
	certFile, err := os.CreateTemp(tmpDirectory, "snyk-cli-cert-*.crt")
	if err != nil {
		logger.Println("failed to create temp cert file")
		return nil, err
	}
	defer certFile.Close()

	certificateLocation := certFile.Name() // gives full path, not just the name

	rootCAs, err := x509.SystemCertPool()
	if err != nil {
		return nil, err
	}

	// append any given extra CA certificate to the internal PEM data before storing it to file
	// this merges user provided CA certificates with the internal one
	certNodePEM := append([]byte(nil), certPEMBlock...)

	if extraCaCertFile, ok := os.LookupEnv(constants.SNYK_CA_CERTIFICATE_LOCATION_ENV); ok {
		extraCertificateBytes, extraCertificateList, extraCertificateError := certs.GetExtraCaCert(extraCaCertFile)
		if extraCertificateError == nil {
			// add to pem data
			certNodePEM = append(certNodePEM, '\n')
			certNodePEM = append(certNodePEM, extraCertificateBytes...)
			// add to cert pool
			for _, currentCert := range extraCertificateList {
				if currentCert != nil {
					rootCAs.AddCert(currentCert)
				}
			}

			logger.Debug().Msgf("Using additional CAs from file: %v", extraCaCertFile)
		}
	}

	// Write certificate file for use by Node.js process
	logger.Debug().Msgf("Temporary CertificateLocation: %v", certificateLocation)
	certPEMString := string(certNodePEM)
	err = utils.WriteToFile(certificateLocation, certPEMString)
	if err != nil {
		logger.Print("failed to write cert to file")
		return nil, err
	}

	// Configure goproxy Certificate
	err = setGlobalProxyCA(certPEMBlock, keyPEMBlock)
	if err != nil {
		return nil, err
	}

	return &CaData{
		CertPool: rootCAs,
		CertFile: certificateLocation,
		CertPem:  certPEMString,
	}, nil
}

func NewWrapperProxy(config configuration.Configuration, cliVersion string, debugLogger *zerolog.Logger, ca CaData) (*WrapperProxy, error) {
	var p WrapperProxy
	p.cliVersion = cliVersion
	p.DebugLogger = debugLogger
	p.CertificateLocation = ca.CertFile
	p.config = config

	insecureSkipVerify := config.GetBool(configuration.INSECURE_HTTPS)

	p.transport = &http.Transport{
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: insecureSkipVerify, // goproxy defaults to true
			RootCAs:            ca.CertPool,
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

// HeaderSnykTerminate is a header to signal that the typescript CLI should terminate execution.
const HeaderSnykTerminate = "snyk-terminate"

func (p *WrapperProxy) handleResponse(resp *http.Response, ctx *goproxy.ProxyCtx) *http.Response {
	if ctx.Error != nil {
		resp.Header.Set(HeaderSnykTerminate, "true")
	}

	return resp
}

func (p *WrapperProxy) checkBasicCredentials(user, password string) bool {
	return user == p.proxyUsername && p.proxyPassword == password
}

func (p *WrapperProxy) HandleConnect(req string, ctx *goproxy.ProxyCtx) (*goproxy.ConnectAction, string) {
	basic := auth.BasicConnect("", p.checkBasicCredentials)
	action, str := basic.HandleConnect(req, ctx)
	p.DebugLogger.Print("HandleConnect - basic authentication result: ", action, str)

	if action == goproxy.OkConnect {
		action, str = goproxy.AlwaysMitm.HandleConnect(req, ctx)
	}

	return action, str
}

func (p *WrapperProxy) Start() error {
	proxy := goproxy.NewProxyHttpServer()
	proxy.Tr = p.transport
	// zerolog based logger also works but it will print empty lines between logs
	proxy.Logger = log.New(&pkg_utils.ToZeroLogDebug{Logger: p.DebugLogger}, "", 0)

	for _, i := range p.interceptors {
		proxy.OnRequest(i.GetCondition()).DoFunc(i.GetHandler())
	}

	proxy.OnRequest().HandleConnect(p)
	proxy.OnResponse().DoFunc(p.handleResponse)
	proxy.Verbose = true
	proxyServer := &http.Server{
		Handler: proxy,
	}

	p.httpServer = proxyServer

	p.DebugLogger.Print("starting proxy")
	address := "127.0.0.1:0"
	l, err := net.Listen("tcp", address)
	if err != nil {
		return err
	}

	p.port = l.Addr().(*net.TCPAddr).Port
	p.DebugLogger.Print("Wrapper proxy is listening on port: ", p.port)

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
}

func setGlobalProxyCA(certPEMBlock []byte, keyPEMBlock []byte) error {
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

func (p *WrapperProxy) RegisterInterceptor(interceptor interceptor.Interceptor) {
	p.interceptors = append(p.interceptors, interceptor)
}

func (p *WrapperProxy) SetUpstreamProxyAuthentication(mechanism httpauth.AuthenticationMechanism) {
	if mechanism != p.authMechanism {
		p.authMechanism = mechanism
		p.DebugLogger.Printf("Enabled Proxy Authentication Mechanism: %s", httpauth.StringFromAuthenticationMechanism(p.authMechanism))
	}

	if httpauth.IsSupportedMechanism(p.authMechanism) { // since Negotiate is not covered by the go http stack, we skip its proxy handling and inject a custom Handling via the DialContext
		p.authenticator = httpauth.NewProxyAuthenticator(p.authMechanism, p.upstreamProxy, log.New(&pkg_utils.ToZeroLogDebug{Logger: p.DebugLogger}, "", 0))
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
