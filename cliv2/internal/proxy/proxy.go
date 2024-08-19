package proxy

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"errors"
	"fmt"
	"log"
	"net"
	"net/http"
	"net/url"
	"os"

	"github.com/google/uuid"
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/networking"
	"github.com/snyk/go-application-framework/pkg/networking/certs"
	pkg_utils "github.com/snyk/go-application-framework/pkg/utils"

	"github.com/snyk/go-application-framework/pkg/networking/middleware"
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

type CaData struct {
	CertPool *x509.CertPool
	CertFile string
}

func InitCA(config configuration.Configuration, cliVersion string, logger *zerolog.Logger) (*CaData, error) {
	cacheDirectory := config.GetString(configuration.CACHE_PATH)

	certName := "snyk-embedded-proxy"
	logWriter := pkg_utils.ToZeroLogDebug{Logger: logger}
	certPEMBlock, keyPEMBlock, err := certs.MakeSelfSignedCert(certName, []string{}, log.New(&logWriter, "", 0))
	if err != nil {
		return nil, err
	}

	tmpDirectory := utils.GetTemporaryDirectory(cacheDirectory, cliVersion)
	err = utils.CreateAllDirectories(cacheDirectory, cliVersion)
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

			logger.Debug().Msgf("Using additional CAs from file: %v", extraCaCertFile)
		}
	}

	logger.Debug().Msgf("Temporary CertificateLocation: %v", certificateLocation)
	certPEMString := string(certPEMBlock)
	err = utils.WriteToFile(certificateLocation, certPEMString)
	if err != nil {
		logger.Print("failed to write cert to file")
		return nil, err
	}

	err = setGlobalProxyCA(certPEMBlock, keyPEMBlock)
	if err != nil {
		return nil, err
	}

	return &CaData{
		CertPool: rootCAs,
		CertFile: certificateLocation,
	}, nil
}

func NewWrapperProxy(config configuration.Configuration, cliVersion string, debugLogger *zerolog.Logger, ca CaData) (*WrapperProxy, error) {
	var p WrapperProxy
	p.cliVersion = cliVersion
	p.addHeaderFunc = func(request *http.Request) error { return nil }
	p.DebugLogger = debugLogger
	p.CertificateLocation = ca.CertFile

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

// headerSnykAuthFailed is used to indicate there was a failure to establish
// authorization in a legacycli proxied HTTP request and response.
//
// The request header is used to propagate this indication from
// NetworkAccess.AddHeaders all the way through proxy middleware into the
// response.
//
// The response header is then used by the Typescript CLI to surface an
// appropriate authentication failure error back to the user.
//
// These layers of indirection are necessary because the Typescript CLI is not
// involved in OAuth authentication at all, but needs to know that an auth
// failure specifically occurred. HTTP status and error catalog codes aren't
// adequate for this purpose because there are non-authentication reasons an API
// request might 401 or 403, such as permissions or entitlements.
const headerSnykAuthFailed = "snyk-auth-failed"

func (p *WrapperProxy) replaceVersionHandler(r *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
	if err := p.addHeaderFunc(r); err != nil {
		if errors.Is(err, middleware.ErrAuthenticationFailed) {
			r.Header.Set(headerSnykAuthFailed, "true")
		}
		p.DebugLogger.Printf("Failed to add header: %s", err)
	}

	networking.LogRequest(r, p.DebugLogger)

	return r, nil
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
	proxy.OnRequest().DoFunc(p.replaceVersionHandler)
	proxy.OnRequest().HandleConnect(p)
	proxy.OnResponse().DoFunc(func(resp *http.Response, ctx *goproxy.ProxyCtx) *http.Response {
		networking.LogResponse(resp, p.DebugLogger)

		if authFailed := resp.Request.Header.Get(headerSnykAuthFailed); authFailed != "" {
			resp.Header.Set(headerSnykAuthFailed, authFailed)
		}
		return resp
	})
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

func (p *WrapperProxy) SetHeaderFunction(addHeaderFunc func(*http.Request) error) {
	p.addHeaderFunc = addHeaderFunc
}
