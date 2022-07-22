//go:build linux || darwin
// +build linux darwin

package httpauth

import (
	"encoding/base64"
	"fmt"
	"io"
	"log"
	"net/url"
	"os"
	"os/user"
	"strings"

	"github.com/jcmturner/gokrb5/v8/client"
	"github.com/jcmturner/gokrb5/v8/config"
	"github.com/jcmturner/gokrb5/v8/credentials"
	"github.com/jcmturner/gokrb5/v8/krberror"
	"github.com/jcmturner/gokrb5/v8/spnego"
)

type NonwindowsSpnegoProvider struct {
	logger     *log.Logger
	configPath string
	cachePath  string
	config     *config.Config
	client     *spnego.SPNEGO
}

func SpnegoProviderInstance() SpnegoProvider {
	s := &NonwindowsSpnegoProvider{}
	s.initDefaultConfiguration()
	return s
}

func (s *NonwindowsSpnegoProvider) initDefaultConfiguration() {
	// logger
	s.logger = log.New(io.Discard, "", 0)

	// configuration location
	s.configPath = os.Getenv("KRB5_CONFIG")
	if _, err := os.Stat(s.configPath); os.IsNotExist(err) {
		s.configPath = "/etc/krb5.conf"
	}

	// cache location
	user, err := user.Current()
	if err == nil {
		s.cachePath = "/tmp/krb5cc_" + user.Uid
		cacheName := os.Getenv("KRB5CCNAME")
		if strings.HasPrefix(cacheName, "FILE:") {
			s.cachePath = strings.SplitN(cacheName, ":", 2)[1]
		}
	} else {
		s.logger.Println("Failed to get current user! ", err)
	}

}

func (s *NonwindowsSpnegoProvider) Close() error {
	return nil
}

func (s *NonwindowsSpnegoProvider) SetLogger(logger *log.Logger) {
	s.logger = logger
}

func (s *NonwindowsSpnegoProvider) init(url *url.URL) ([]byte, error) {
	hostname := url.Hostname()
	spn := "HTTP/" + hostname
	token := []byte{}
	var err error

	s.logger.Printf("krb5 configuration file: %s", s.configPath)
	s.config, err = config.Load(s.configPath)
	if err != nil {
		return token, err
	}

	s.logger.Printf("krb5 cache file: %s", s.cachePath)
	cache, err := credentials.LoadCCache(s.cachePath)
	if err != nil {
		return token, err
	}

	krb5client, err := client.NewFromCCache(cache, s.config, client.DisablePAFXFAST(true))

	s.client = spnego.SPNEGOClient(krb5client, spn)

	tokenObject, err := s.client.InitSecContext()
	if err != nil {
		return token, fmt.Errorf("could not initialize context: %v", err)
	}

	token, err = tokenObject.Marshal()
	if err != nil {
		return token, krberror.Errorf(err, krberror.EncodingError, "could not marshal SPNEGO")
	}

	return token, err
}

func (s *NonwindowsSpnegoProvider) GetToken(url *url.URL, responseToken string) (string, bool, error) {
	var err error
	var token []byte
	var encodedToken string
	done := false

	if s.client == nil {
		token, err = s.init(url)
	} else {
		err = fmt.Errorf("NonwindowsSpnegoProvider.update() is not yet implemented. Only preemptive authentication is supported!")
	}

	if len(token) > 0 {
		encodedToken = base64.StdEncoding.EncodeToString(token)
	}

	return encodedToken, done, err
}
