package core

import (
	"bytes"
	"encoding/base64"
	"strings"
	"testing"
	"time"

	"github.com/rs/zerolog"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"

	"github.com/snyk/go-application-framework/pkg/auth"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/logging"
)

func Test_initDebugLogger_doesNotDropEventsWithEscapedQuotes(t *testing.T) {
	var out bytes.Buffer
	config := configuration.NewWithOpts()

	logger, _ := initTestDebugLogger(&out, config)

	logger.Info().Str("data_value", `a"b`).Msg("test message with escaped quote")

	output := out.String()
	assert.NotEmpty(t, output, "Logger should not drop events with escaped quotes")
	assert.Contains(t, output, "test message with escaped quote")
	assert.Contains(t, output, `data_value=`)
}

func Test_initDebugLogger_doesNotDropEventsWithNumericFields(t *testing.T) {
	var out bytes.Buffer
	config := configuration.NewWithOpts()

	logger, _ := initTestDebugLogger(&out, config)

	logger.Info().Int("p", 5).Msg("test message")

	output := out.String()
	assert.NotEmpty(t, output, "Logger should not drop events with numeric fields")
	assert.Contains(t, output, "test message")
	assert.Contains(t, output, "p=5")
}

func Test_initDebugLogger_scrubsConfigSecrets(t *testing.T) {
	const apiToken = "f0e1d2c3-aaaa-bbbb-cccc-1234567890ab"
	bearerToken := fakeJWT()
	accessToken := fakeAccessToken()

	var out bytes.Buffer
	config := configuration.NewWithOpts()
	config.Set(configuration.AUTHENTICATION_TOKEN, apiToken)
	config.Set(configuration.AUTHENTICATION_BEARER_TOKEN, bearerToken)
	config.Set(auth.CONFIG_KEY_OAUTH_TOKEN, `{"access_token":"`+accessToken+`"}`)

	logger, _ := initTestDebugLogger(&out, config)

	logger.Info().Msgf("Using tokens: %s %s %s", apiToken, bearerToken, accessToken)

	output := out.String()
	assert.NotEmpty(t, output, "Logger should produce output")
	assert.NotContains(t, output, apiToken, "API token should be redacted")
	assert.NotContains(t, output, bearerToken, "Bearer token should be redacted")
	assert.NotContains(t, output, accessToken, "Access token should be redacted")
	assert.Contains(t, output, "***", "Redacted secrets should be replaced with ***")
}

func Test_initDebugLogger_scrubsTermsAddedAfterInit(t *testing.T) {
	const lateTerm = "lateAddedSecret_999"

	var out bytes.Buffer
	config := configuration.NewWithOpts()

	logger, scrubber := initTestDebugLogger(&out, config)

	logger.Info().Msg("before: " + lateTerm)
	scrubber.AddTermsToReplace([]string{lateTerm})
	logger.Info().Msg("after: " + lateTerm)

	output := out.String()
	lines := strings.Split(strings.TrimSpace(output), "\n")
	require.Len(t, lines, 2, "Should have two log lines")

	assert.Contains(t, lines[0], "before: "+lateTerm, "Term should not be redacted before it's added")
	assert.NotContains(t, lines[1], "after: "+lateTerm, "Term should be redacted after it's added")
	assert.Contains(t, lines[1], "***", "Redacted term should be replaced with ***")
}

func Test_initDebugLogger_scrubsFieldNamePatterns(t *testing.T) {
	tests := []struct {
		name      string
		fieldName string
		value     string
	}{
		{"password field", "password", "value-1"},
		{"api_key field", "api_key", "value-2"},
		{"client_secret field", "client_secret", "value-3"},
		{"token field", "token", "value-4"},
		{"API_KEY uppercase", "API_KEY", "value-5"},
		{"my-password with dash", "my-password", "value-6"},
		{"user.token with dot", "user.token", "value-7"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			var out bytes.Buffer
			config := configuration.NewWithOpts()

			logger, _ := initTestDebugLogger(&out, config)

			logger.Info().Str(tt.fieldName, tt.value).Msg("test")

			output := out.String()
			assert.NotEmpty(t, output, "Logger should produce output")
			assert.NotContains(t, output, tt.value, "Sensitive field value should be redacted")
			assert.Contains(t, output, "***", "Redacted value should be replaced with ***")
		})
	}
}

func Test_initDebugLogger_scrubsFieldNamePatternsInMessage(t *testing.T) {
	var out bytes.Buffer
	config := configuration.NewWithOpts()

	logger, _ := initTestDebugLogger(&out, config)

	logger.Info().Msg("config: password=value-a api_key=value-b token=value-c")

	output := out.String()
	assert.NotEmpty(t, output, "Logger should produce output")
	assert.NotContains(t, output, "value-a", "Password value should be redacted")
	assert.NotContains(t, output, "value-b", "API key value should be redacted")
	assert.NotContains(t, output, "value-c", "Token value should be redacted")
	assert.Contains(t, output, "***", "Redacted values should be replaced with ***")
}

func Test_initDebugLogger_acceptableOverRedaction(t *testing.T) {
	var out bytes.Buffer
	config := configuration.NewWithOpts()

	logger, _ := initTestDebugLogger(&out, config)

	logger.Info().Int("tokenCount", 5).Msg("test")

	output := out.String()
	assert.NotEmpty(t, output, "Logger should produce output")
	assert.Contains(t, output, "test", "Message should be present")
}

func Test_initDebugLogger_returnsScrubbingWriter(t *testing.T) {
	var out bytes.Buffer
	config := configuration.NewWithOpts()

	_, scrubber := initTestDebugLogger(&out, config)

	require.NotNil(t, scrubber, "Should return a non-nil scrubbing writer")
	assert.NotPanics(t, func() {
		scrubber.AddTermsToReplace([]string{"test"})
	}, "Returned scrubber should support AddTermsToReplace")
}

func initTestDebugLogger(out *bytes.Buffer, config configuration.Configuration) (zerolog.Logger, logging.ScrubbingLogWriter) {
	scrubLogger := logging.NewScrubbingWriter(zerolog.MultiLevelWriter(out), logging.GetScrubDictFromConfig(config))
	scrubWriter := scrubLogger.(logging.ScrubbingLogWriter)
	scrubWriter.AddTerm(`(?i)\b[\w.-]*(?:passw|secret|token|api_?key)[\w.-]*=("(?:[^"\\]|\\.)*"|\S+)`, 1)

	var consoleWriter = zerolog.ConsoleWriter{
		Out:        scrubLogger,
		TimeFormat: time.RFC3339,
		NoColor:    true,
		PartsOrder: []string{
			zerolog.TimestampFieldName,
			"ext",
			"separator",
			zerolog.CallerFieldName,
			zerolog.MessageFieldName,
		},
		FieldsExclude: []string{"ext", "separator"},
		FormatTimestamp: func(i interface{}) string {
			timeString, ok := i.(string)
			if !ok {
				return ""
			}
			t, err := time.Parse(time.RFC3339, timeString)
			if err != nil {
				return ""
			}
			return strings.ToUpper(t.UTC().Format(time.RFC3339))
		},
	}

	localLogger := zerolog.New(consoleWriter).With().Str("ext", "main").Str("separator", "-").Timestamp().Logger()
	return localLogger, scrubWriter
}

func fakeJWT() string {
	enc := base64.RawURLEncoding.EncodeToString
	return enc([]byte(`{"alg":"HS256"}`)) + "." + enc([]byte(`{"sub":"x"}`)) + "." + enc([]byte("test-signature"))
}

func fakeAccessToken() string {
	return "oauth" + strings.Repeat("Ab1", 8)
}
