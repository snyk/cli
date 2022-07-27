package httpauth_test

import (
	"net/url"
	"testing"

	"github.com/snyk/cli/cliv2/internal/httpauth"
	"github.com/stretchr/testify/assert"
)

func Test_DisableAuthentication(t *testing.T) {

	proxyAddr, _ := url.Parse("http://127.0.0.1")
	expectedValue := ""

	authHandler := httpauth.NewHandler(httpauth.NoAuth)

	actualValue, err := authHandler.GetAuthorizationValue(proxyAddr, "")
	assert.Nil(t, err)

	assert.Equal(t, expectedValue, actualValue)

}

func Test_EnabledAuthentication_Mock(t *testing.T) {

	proxyAddr, _ := url.Parse("http://127.0.0.1")
	expectedValue := "Mock"

	authHandler := httpauth.NewHandler(httpauth.Mock)

	actualValue, err := authHandler.GetAuthorizationValue(proxyAddr, "")
	assert.Nil(t, err)

	assert.Contains(t, actualValue, expectedValue)

}

func Test_AuthenticationMechanismFromAndToString(t *testing.T) {

	testSet := []httpauth.AuthenticationMechanism{
		httpauth.Mock,
		httpauth.Negotiate,
		httpauth.NoAuth,
		httpauth.UnknownMechanism,
	}

	var mechanismConverted httpauth.AuthenticationMechanism
	var mechanismString string

	for _, mechanism := range testSet {
		mechanismString = httpauth.StringFromAuthenticationMechanism(mechanism)
		mechanismConverted = httpauth.AuthenticationMechanismFromString(mechanismString)
		assert.Equal(t, mechanism, mechanismConverted)
	}

}

func Test_LookupSchemeFromAddress(t *testing.T) {
	defaultValue := "none"

	input := map[string]string{
		"snyk.io:443":     "https",
		"snyk.io:80":      "http",
		"snyk.io:1080":    "socks5",
		"snyk.io":         defaultValue,
		"snyk.io:443:das": defaultValue,
	}

	for addr, expected := range input {
		actual := httpauth.LookupSchemeFromCannonicalAddress(addr, defaultValue)
		assert.Equal(t, expected, actual)
	}
}
