package proxy

import (
	"context"
	"crypto/tls"
	"crypto/x509"
	"fmt"
	"log"
	"net"
	"net/http"
	"os"
	"snyk/cling/internal/certs"
	"snyk/cling/internal/utils"

	"github.com/elazarl/goproxy"
)

type WrapperProxy struct {
	httpServer          *http.Server
	DebugLogger         *log.Logger
	CertificateLocation string
}

func NewWrapperProxy(insecureSkipVerify bool, cacheDirectory string, cliVersion string, debugLogger *log.Logger) (*WrapperProxy, error) {
	var p WrapperProxy
	p.DebugLogger = debugLogger

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
		Proxy: http.ProxyFromEnvironment,
		TLSClientConfig: &tls.Config{
			InsecureSkipVerify: insecureSkipVerify, // goproxy defaults to true
		},
	}

	proxy.Logger = debugLogger
	proxy.OnRequest().HandleConnect(goproxy.AlwaysMitm)
	proxy.OnRequest().DoFunc(func(r *http.Request, ctx *goproxy.ProxyCtx) (*http.Request, *http.Response) {
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
