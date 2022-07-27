package httpauth

import (
	"fmt"
	"io"
	"log"
	"net/url"
)

type AuthenticationMechanism string
type AuthenticationState int

const maxCycleCount int = 10

const (
	NoAuth           AuthenticationMechanism = "NoAuth"
	Mock             AuthenticationMechanism = "Mock"
	Negotiate        AuthenticationMechanism = "Negotiate"
	UnknownMechanism AuthenticationMechanism = "UnknownMechanism"
)

const (
	Initial     AuthenticationState = iota
	Negotiating AuthenticationState = iota
	Done        AuthenticationState = iota
	Error       AuthenticationState = iota
	Cancel      AuthenticationState = iota
	Close       AuthenticationState = iota
)

const (
	AuthorizationKey      string = "Authorization"
	ProxyAuthorizationKey string = "Proxy-Authorization"
	ProxyAuthenticateKey  string = "Proxy-Authenticate"
)

type AuthenticationHandlerInterface interface {
	Close()
	Cancel()
	Succesful()
	IsStopped() bool
	GetAuthorizationValue(url *url.URL, responseToken string) (string, error)
	SetLogger(logger *log.Logger)
}

type AuthenticationHandler struct {
	spnegoProvider SpnegoProvider
	Mechanism      AuthenticationMechanism
	state          AuthenticationState
	cycleCount     int
	logger         *log.Logger
}

func NewHandler(mechanism AuthenticationMechanism) AuthenticationHandlerInterface {
	a := &AuthenticationHandler{
		spnegoProvider: SpnegoProviderInstance(),
		Mechanism:      mechanism,
		state:          Initial,
		logger:         log.New(io.Discard, "", 0),
	}
	return a
}

func (a *AuthenticationHandler) Close() {
	a.spnegoProvider.Close()
	a.state = Close
}

func (a *AuthenticationHandler) GetAuthorizationValue(url *url.URL, responseToken string) (string, error) {
	authorizeValue := ""
	mechanism := string(a.Mechanism)
	var err error

	if a.Mechanism == Negotiate { // supporting mechanism: Negotiate (SPNEGO)
		var token string
		var done bool

		if len(responseToken) == 0 && Negotiating == a.state {
			a.state = Error
			return "", fmt.Errorf("Authentication failed! Unexpected empty token during negotiation!")
		}

		a.state = Negotiating

		token, done, err = a.spnegoProvider.GetToken(url, responseToken)
		if err != nil {
			a.state = Error
			return "", err
		}

		if done {
			a.logger.Println("Security context done!")
		}

		authorizeValue = mechanism + " " + token
	} else if a.Mechanism == Mock { // supporting mechanism: Mock for testing
		authorizeValue = mechanism + " " + responseToken
		a.Succesful()
	}

	a.cycleCount++
	if a.cycleCount >= maxCycleCount {
		err = fmt.Errorf("Failed to authenticate with %d cycles, stopping now!", maxCycleCount)
	}

	return authorizeValue, err
}

func (a *AuthenticationHandler) IsStopped() bool {
	return (a.state == Done || a.state == Error || a.state == Cancel || a.state == Close)
}

func (a *AuthenticationHandler) Reset() {
	a.state = Initial
	a.cycleCount = 0
	a.logger.Println("AuthenticationHandler.Reset()")
}

func (a *AuthenticationHandler) Cancel() {
	a.state = Cancel
	a.logger.Println("AuthenticationHandler.Cancel()")
}

func (a *AuthenticationHandler) Succesful() {
	a.state = Done
	a.logger.Println("AuthenticationHandler.Succesful()")
}

func (a *AuthenticationHandler) SetLogger(logger *log.Logger) {
	a.logger = logger
	a.spnegoProvider.SetLogger(logger)
}

func StringFromAuthenticationMechanism(mechanism AuthenticationMechanism) string {
	return string(mechanism)
}

func AuthenticationMechanismFromString(mechanism string) AuthenticationMechanism {
	return AuthenticationMechanism(mechanism)
}
