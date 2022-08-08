/*
Entry point class for the CLIv2 version.
*/
package cliv2

import (
	_ "embed"
	"log"

	"github.com/snyk/cli/cliv2/internal/httpauth"
)

type CliConfiguration struct {
	CacheDirectory               string
	Insecure                     bool
	ProxyAuthenticationMechanism httpauth.AuthenticationMechanism
	ProxyAddr                    string
	Debug                        bool
	DebugLogger                  *log.Logger
}

func (c *CliConfiguration) Log() {
	c.DebugLogger.Printf("CacheDirectory: %s\n", c.CacheDirectory)
	c.DebugLogger.Printf("Insecure: %v\n", c.Insecure)

	if len(c.ProxyAddr) > 0 {
		c.DebugLogger.Printf("ProxyAddr: %s\n", c.ProxyAddr)
	}

	c.DebugLogger.Printf("ProxyAuthenticationMechanism: %s\n", c.ProxyAuthenticationMechanism)
}
