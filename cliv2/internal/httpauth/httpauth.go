package httpauth

import (
	"fmt"
	"io"
	"log"
	"net/url"
	"strings"
)

type AuthenticationMechanism string
type AuthenticationState int

const maxCycleCount int = 10

const (
	NoAuth           AuthenticationMechanism = "noauth"
	Negotiate        AuthenticationMechanism = "negotiate"
	AnyAuth          AuthenticationMechanism = "anyauth"
	UnknownMechanism AuthenticationMechanism = "unknownmechanism"
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
	Update(availableMechanism map[AuthenticationMechanism]string) (string, error)
	SetLogger(logger *log.Logger)
	SetSpnegoProvider(spnegoProvider SpnegoProvider)
}

type AuthenticationHandler struct {
	spnegoProvider  SpnegoProvider
	Mechanism       AuthenticationMechanism
	activeMechanism AuthenticationMechanism
	state           AuthenticationState
	cycleCount      int
	logger          *log.Logger
}

func NewHandler(mechanism AuthenticationMechanism) AuthenticationHandlerInterface {
	a := &AuthenticationHandler{
		spnegoProvider:  SpnegoProviderInstance(),
		Mechanism:       mechanism,
		activeMechanism: mechanism,
		state:           Initial,
		logger:          log.New(io.Discard, "", 0),
	}

	return a
}

func (a *AuthenticationHandler) Close() {
	a.spnegoProvider.Close()
	a.state = Close
}

func (a *AuthenticationHandler) GetAuthorizationValue(url *url.URL, responseToken string) (authorizeValue string, err error) {
	mechanism := StringFromAuthenticationMechanism(a.activeMechanism)

	if a.activeMechanism == Negotiate { // supporting mechanism: Negotiate (SPNEGO)
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
			a.logger.Println("Local security context established!")
		}

		authorizeValue = mechanism + " " + token

		if len(token) > 0 {
			mechanisms, _ := GetMechanismsFromHttpFieldValue(authorizeValue)
			a.logger.Printf("Authorization to %s using: %s", url, mechanisms)
		}
	}

	a.cycleCount++
	if a.cycleCount >= maxCycleCount {
		err = fmt.Errorf("Failed to authenticate within %d cycles, stopping now!", maxCycleCount)
		authorizeValue = ""
	}

	return authorizeValue, err
}

func (a *AuthenticationHandler) Update(availableMechanism map[AuthenticationMechanism]string) (responseToken string, err error) {

	// if AnyAuth is selected, we need to determine the best supported mechanism on both sides
	if a.activeMechanism == AnyAuth {
		// currently we only support Negotiate, AnyAuth will use Negotiate if the communication partner proposes it
		if _, ok := availableMechanism[Negotiate]; ok {
			a.activeMechanism = Negotiate
			a.logger.Printf("Selected Mechanism: %s\n", StringFromAuthenticationMechanism(a.activeMechanism))
		}
	}

	// extract the token for the active mechanism
	if token, ok := availableMechanism[a.activeMechanism]; ok {
		responseToken = token
	} else {
		err = fmt.Errorf("Incorrect or unsupported Mechanism detected! %s", availableMechanism)
	}

	return responseToken, err
}

func (a *AuthenticationHandler) IsStopped() bool {
	return (a.state == Done || a.state == Error || a.state == Cancel || a.state == Close)
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

func (a *AuthenticationHandler) SetSpnegoProvider(spnegoProvider SpnegoProvider) {
	a.spnegoProvider = spnegoProvider
}

func StringFromAuthenticationMechanism(mechanism AuthenticationMechanism) string {
	return strings.Title(string(mechanism))
}

func AuthenticationMechanismFromString(mechanism string) AuthenticationMechanism {
	tmp := strings.ToLower(mechanism)
	return AuthenticationMechanism(tmp)
}

func GetMechanismAndToken(HttpFieldValue string) (AuthenticationMechanism, string) {
	mechanism := UnknownMechanism
	token := ""

	authenticateValue := strings.Split(HttpFieldValue, " ")
	if len(authenticateValue) >= 1 {
		mechanism = AuthenticationMechanismFromString(authenticateValue[0])
	}

	if len(authenticateValue) == 2 {
		token = authenticateValue[1]
	}

	return mechanism, token
}

func IsSupportedMechanism(mechanism AuthenticationMechanism) bool {
	if mechanism == Negotiate || mechanism == AnyAuth {
		return true
	}
	return false
}
