package httpauth

import (
	"fmt"
	"log"
	"net/url"
	"os"
	"testing"

	"github.com/golang/mock/gomock"
	"github.com/stretchr/testify/assert"
)

var testLogger = log.New(os.Stderr, "", log.Ldate|log.Ltime|log.Lmicroseconds|log.Lshortfile)

const (
	NTML_01_INITIALMESSAGE = "TlRMTVNTUAABAAAAl4II4gAAAAAAAAAAAAAAAAAAAAAKADk4AAAADw=="
	NTML_02_CHALLENGE      = "TlRMTVNTUAACAAAADgAOADgAAAAVgoni63VPOgRoQ04AAAAAAAAAAKQApABGAAAABgEAAAAAAA9IAEEATQBNAEUAUgAyAAIADgBIAEEATQBNAEUAUgAyAAEAHABFAEMAMgBBAE0AQQBaAC0AVgBVAEgATABOAFEABAAeAGgAYQBtAG0AZQByADIALgBzAG4AeQBrAC4AaQBvAAMAPABlAGMAMgBhAG0AYQB6AC0AdgB1AGgAbABuAHEALgBoAGEAbQBtAGUAcgAyAC4AcwBuAHkAawAuAGkAbwAHAAgAzu0E3y2j2AEAAAAA"
	NTML_03_RESPONSE       = "TlRMTVNTUAADAAAAGAAYAI4AAABcAVwBpgAAAA4ADgBYAAAACgAKAGYAAAAeAB4AcAAAABAAEAACAgAAFYKI4goAOTgAAAAPxbettwPT/UuVcj7f+eHILmgAYQBtAG0AZQByADIAQQBkAG0AaQBuAEUAQwAyAEEATQBBAFoALQA4ADMATwBVADMARABUAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAB/6ZPp6zbTJBkvgadfD80wBAQAAAAAAAM7tBN8to9gBZ6ejc1nCVp0AAAAAAgAOAEgAQQBNAE0ARQBSADIAAQAcAEUAQwAyAEEATQBBAFoALQBWAFUASABMAE4AUQAEAB4AaABhAG0AbQBlAHIAMgAuAHMAbgB5AGsALgBpAG8AAwA8AGUAYwAyAGEAbQBhAHoALQB2AHUAaABsAG4AcQAuAGgAYQBtAG0AZQByADIALgBzAG4AeQBrAC4AaQBvAAcACADO7QTfLaPYAQYABAACAAAACAAwADAAAAAAAAAAAQAAAAAgAADQl5cStKyz5f8Kuwh+f2BiiWY4vHopxNdJTsXVQqRoLgoAEAAAAAAAAAAAAAAAAAAAAAAACQA0AEgAVABUAFAALwBwAHIAbwB4AHkALgBoAGEAbQBtAGUAcgAyAC4AcwBuAHkAawAuAGkAbwAAAAAAAAAAACKmvM2kkvW9vroG6NaLu8s="
)

func Test_DisableAuthentication(t *testing.T) {

	proxyAddr, _ := url.Parse("http://127.0.0.1")
	expectedValue := ""

	authHandler := NewHandler(NoAuth)

	actualValue, err := authHandler.GetAuthorizationValue(proxyAddr, "")
	assert.Nil(t, err)

	assert.Equal(t, expectedValue, actualValue)

}

func Test_EnabledAuthentication_Negotiate_Success_NLTM(t *testing.T) {

	// specify test data
	proxyAddr, _ := url.Parse("http://127.0.0.1")
	mechanism := Negotiate
	expectedValue := StringFromAuthenticationMechanism(mechanism)

	// setup test environment
	spnegoProviderMock := NewMockSpnegoProvider(gomock.NewController(t))
	defer spnegoProviderMock.ctrl.Finish()
	spnegoProviderMock.EXPECT().GetToken(proxyAddr, "").Times(1).Return(NTML_01_INITIALMESSAGE, false, nil)
	spnegoProviderMock.EXPECT().GetToken(proxyAddr, NTML_02_CHALLENGE).Times(1).Return(NTML_03_RESPONSE, true, nil)

	authHandler := NewHandler(mechanism)
	authHandler.SetSpnegoProvider(spnegoProviderMock)

	// actually test
	actualValue, err := authHandler.GetAuthorizationValue(proxyAddr, "")
	assert.Nil(t, err)
	assert.Contains(t, actualValue, expectedValue)
	assert.False(t, authHandler.IsStopped())

	actualValue, err = authHandler.GetAuthorizationValue(proxyAddr, NTML_02_CHALLENGE)
	assert.Nil(t, err)
	assert.Contains(t, actualValue, expectedValue)
	assert.False(t, authHandler.IsStopped())

	authHandler.Succesful()
	assert.True(t, authHandler.IsStopped())
}

func Test_EnabledAuthentication_Negotiate_Fail_NLTM01(t *testing.T) {

	// specify test data
	proxyAddr, _ := url.Parse("http://127.0.0.1")
	mechanism := Negotiate
	expectedValue := StringFromAuthenticationMechanism(mechanism)

	// setup test environment
	spnegoProviderMock := NewMockSpnegoProvider(gomock.NewController(t))
	defer spnegoProviderMock.ctrl.Finish()
	spnegoProviderMock.EXPECT().GetToken(proxyAddr, "").Times(1).Return(NTML_01_INITIALMESSAGE, false, nil)

	authHandler := NewHandler(mechanism)
	authHandler.SetSpnegoProvider(spnegoProviderMock)

	// actually test
	actualValue, err := authHandler.GetAuthorizationValue(proxyAddr, "")
	assert.Nil(t, err)
	assert.Contains(t, actualValue, expectedValue)
	assert.False(t, authHandler.IsStopped())

	actualValue, err = authHandler.GetAuthorizationValue(proxyAddr, "") // unexpected during negotiation
	assert.NotNil(t, err)
	assert.Empty(t, actualValue)
	assert.True(t, authHandler.IsStopped())
}

func Test_EnabledAuthentication_Negotiate_Fail_NLTM02(t *testing.T) {

	// specify test data
	proxyAddr, _ := url.Parse("http://127.0.0.1")
	mechanism := Negotiate
	expectedValue := StringFromAuthenticationMechanism(mechanism)
	incorrectResponseToken := "Some incorrect token maybe"

	// setup test environment
	spnegoProviderMock := NewMockSpnegoProvider(gomock.NewController(t))
	defer spnegoProviderMock.ctrl.Finish()
	spnegoProviderMock.EXPECT().GetToken(proxyAddr, "").Times(1).Return(NTML_01_INITIALMESSAGE, false, nil)
	spnegoProviderMock.EXPECT().GetToken(proxyAddr, incorrectResponseToken).Times(1).Return("", false, fmt.Errorf("Something went wrong")) // returning an error from the spnegoProvider

	authHandler := NewHandler(mechanism)
	authHandler.SetSpnegoProvider(spnegoProviderMock)

	// actually test
	actualValue, err := authHandler.GetAuthorizationValue(proxyAddr, "")
	assert.Nil(t, err)
	assert.Contains(t, actualValue, expectedValue)
	assert.False(t, authHandler.IsStopped())

	actualValue, err = authHandler.GetAuthorizationValue(proxyAddr, incorrectResponseToken)
	assert.NotNil(t, err)
	assert.Empty(t, actualValue)
	assert.True(t, authHandler.IsStopped())
}

func Test_EnabledAuthentication_Negotiate_Fail_NLTM03(t *testing.T) {

	// specify test data
	proxyAddr, _ := url.Parse("http://127.0.0.1")
	mechanism := Negotiate
	expectedValue := StringFromAuthenticationMechanism(mechanism)

	// setup test environment
	spnegoProviderMock := NewMockSpnegoProvider(gomock.NewController(t))
	defer spnegoProviderMock.ctrl.Finish()
	spnegoProviderMock.EXPECT().GetToken(proxyAddr, "").Times(1).Return(NTML_01_INITIALMESSAGE, false, nil)
	spnegoProviderMock.EXPECT().GetToken(proxyAddr, NTML_02_CHALLENGE).MinTimes(2).Return("", false, nil)

	authHandler := NewHandler(mechanism)
	authHandler.SetSpnegoProvider(spnegoProviderMock)

	// actually test
	actualValue, err := authHandler.GetAuthorizationValue(proxyAddr, "")
	assert.Nil(t, err)
	assert.Contains(t, actualValue, expectedValue)
	assert.False(t, authHandler.IsStopped())

	for i := 0; i < maxCycleCount-2; i++ {
		actualValue, err = authHandler.GetAuthorizationValue(proxyAddr, NTML_02_CHALLENGE)
		assert.Nil(t, err)
		assert.Contains(t, actualValue, expectedValue)
		assert.False(t, authHandler.IsStopped())
	}

	actualValue, err = authHandler.GetAuthorizationValue(proxyAddr, NTML_02_CHALLENGE) // exceed max cycles of authentication messages exchanged
	assert.NotNil(t, err)
	assert.Empty(t, actualValue)
	assert.False(t, authHandler.IsStopped())

}

func Test_EnabledAuthentication_Negotiate_Update_AnyAuth_success(t *testing.T) {
	// specify test data
	mechanism := AnyAuth
	expectedToken := "ghi"
	availableMechanism := map[AuthenticationMechanism]string{
		NoAuth:           "abc",
		Negotiate:        expectedToken,
		UnknownMechanism: "def",
	}

	// setup test environment
	authHandler := NewHandler(mechanism)

	actualToken, err := authHandler.Update(availableMechanism)
	assert.Nil(t, err)
	assert.Equal(t, expectedToken, actualToken)
}

func Test_EnabledAuthentication_Negotiate_Update_AnyAuth_fail(t *testing.T) {
	// specify test data
	mechanism := AnyAuth
	expectedToken := ""
	availableMechanism := map[AuthenticationMechanism]string{
		NoAuth:           "abc",
		UnknownMechanism: "def",
	}

	// setup test environment
	authHandler := NewHandler(mechanism)

	actualToken, err := authHandler.Update(availableMechanism)
	assert.NotNil(t, err)
	assert.Equal(t, expectedToken, actualToken)
}

func Test_AuthenticationMechanismFromAndToString(t *testing.T) {

	testSet := []AuthenticationMechanism{
		AnyAuth,
		Negotiate,
		NoAuth,
		UnknownMechanism,
	}

	var mechanismConverted AuthenticationMechanism
	var mechanismString string

	for _, mechanism := range testSet {
		mechanismString = StringFromAuthenticationMechanism(mechanism)
		mechanismConverted = AuthenticationMechanismFromString(mechanismString)
		assert.Equal(t, mechanism, mechanismConverted)
	}

	// different casing
	mechanismConverted = AuthenticationMechanismFromString("NEGOTIATE")
	assert.Equal(t, Negotiate, mechanismConverted)
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
		actual := LookupSchemeFromCannonicalAddress(addr, defaultValue)
		assert.Equal(t, expected, actual)
	}
}
