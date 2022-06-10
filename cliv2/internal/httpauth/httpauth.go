package httpauth

import (
	"net/http"
	"net/url"

	"github.com/dpotapov/go-spnego"
)

type AuthenticationMechanism int

const (
	NoAuth    AuthenticationMechanism = iota
	Mock      AuthenticationMechanism = iota
	Negotiate AuthenticationMechanism = iota
)

const (
	AuthorizationKey      string = "Authorization"
	ProxyAuthorizationKey string = "Proxy-Authorization"
)

type AuthenticationHandler struct {
	Mechanism AuthenticationMechanism
}

func (a *AuthenticationHandler) GetAuthorizationValue(url *url.URL) (string, error) {

	var authorizeValue string

	tmpRequest := http.Request{
		URL:    url,
		Header: map[string][]string{},
	}

	if a.Mechanism == Negotiate { // supporting mechanism: Negotiate (SPNEGO)
		var provider spnego.Provider = spnego.New()
		cannonicalize := false

		if err := provider.SetSPNEGOHeader(&tmpRequest, cannonicalize); err != nil {
			return "", err
		}
	} else if a.Mechanism == Mock { // supporting mechanism: Mock for testing
		tmpRequest.Header.Set(AuthorizationKey, "Mock")
	}

	// ugly work around the fact that go-spnego only adds an "Authorize" Header and not "Proxy-Authorize"
	if a.Mechanism != NoAuth {
		authorizeValue = tmpRequest.Header.Get(AuthorizationKey)
	}

	return authorizeValue, nil
}

func StringFromAuthenticationMechanism(mechanism AuthenticationMechanism) string {
	var result string
	switch mechanism {
	case NoAuth:
		result = "NoAuth"
	case Negotiate:
		result = "Negotiate"
	case Mock:
		result = "Mock"
	default:
		result = "Unknonwn AuthenticationMechanism"
	}
	return result
}
