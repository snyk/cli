package core

import (
	"bytes"
	"testing"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/logging"
)

// The scrubbing writer is built from the default configuration, before a profile is selected. A secret that only the
// configuration of the run holds, for example the token of a profile, must be scrubbed after scrubConfigurationSecrets.
func Test_scrubConfigurationSecrets_scrubsSecretsTheWriterDidNotKnow(t *testing.T) {
	const secret = "SECRETPROFILETOKEN-0123456789"
	var out bytes.Buffer
	writer := logging.NewScrubbingWriter(zerolog.MultiLevelWriter(&out), logging.GetScrubDictFromConfig(configuration.NewWithOpts()))
	logger := zerolog.New(writer)

	config := configuration.NewWithOpts()
	config.Set(configuration.AUTHENTICATION_TOKEN, secret)
	r := &cliRun{config: config, scrubber: writer.(logging.ScrubbingLogWriter)}

	logger.Log().Msg("before: " + secret)
	r.scrubConfigurationSecrets()
	logger.Log().Msg("after: " + secret)

	assert.Contains(t, out.String(), "before: "+secret)
	assert.NotContains(t, out.String(), "after: "+secret)
	assert.Contains(t, out.String(), "after: ***")
}

func Test_scrubConfigurationSecrets_withoutWriterDoesNothing(t *testing.T) {
	r := &cliRun{config: configuration.NewWithOpts()}
	assert.NotPanics(t, r.scrubConfigurationSecrets)
}
