package httpauth

import (
	"encoding/base64"
	"github.com/alexbrainman/sspi/negotiate"
	"log"
	"net/url"
)

type WindowsSpnegoProvider struct {
	clientContext *negotiate.ClientContext
}

func SpnegoProviderInstance() SpnegoProvider {
	return &WindowsSpnegoProvider{}
}

func (s *WindowsSpnegoProvider) init(url *url.URL) ([]byte, error) {
	hostname := url.Hostname()
	token := []byte{}

	spn := "HTTP/" + hostname

	cred, err := negotiate.AcquireCurrentUserCredentials()
	if err != nil {
		return token, err
	}
	defer cred.Release()

	secctx, token, err := negotiate.NewClientContext(cred, spn)
	if err != nil {
		return token, err
	}

	s.clientContext = secctx
	return token, nil
}

func (s *WindowsSpnegoProvider) update(responseToken string) ([]byte, bool, error) {
	var decodedToken []byte
	var newRequesToken []byte
	var err error
	done := false

	decodedToken, err = base64.StdEncoding.DecodeString(responseToken)
	if err != nil {
		return newRequesToken, done, err
	}

	done, newRequesToken, err = s.clientContext.Update(decodedToken)

	return newRequesToken, done, err
}

func (s *WindowsSpnegoProvider) GetToken(url *url.URL, responseToken string) (string, bool, error) {
	var err error
	var token []byte
	done := false

	if s.clientContext == nil {
		token, err = s.init(url)
	} else {
		token, done, err = s.update(responseToken)
	}

	encodedToken := base64.StdEncoding.EncodeToString(token)
	return encodedToken, done, err
}

func (s *WindowsSpnegoProvider) Close() error {
	return s.clientContext.Release()
}

func (s *WindowsSpnegoProvider) SetLogger(logger *log.Logger) {
	//this implementation currently doesn't require a logger
}
