package main

// !!! This import needs to be the first import, please do not change this !!!
import _ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"

import (
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"

	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/logging"

	debug_tools "github.com/snyk/cli/cliv2/internal/debug"
)

func initDebugLogger(config configuration.Configuration) *zerolog.Logger {
	var consoleWriter = zerolog.ConsoleWriter{
		Out:        os.Stderr,
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
			t, _ := time.Parse(time.RFC3339, i.(string))
			return strings.ToUpper(t.UTC().Format(time.RFC3339))
		},
	}

	scrubLogger := logging.NewScrubbingWriter(zerolog.MultiLevelWriter(consoleWriter), logging.GetScrubDictFromConfig(config))
	localLogger := zerolog.New(scrubLogger).With().Str("ext", "main").Str("separator", "-").Timestamp().Logger()
	loglevel := debug_tools.GetDebugLevel(config)
	debugLogger := localLogger.Level(loglevel)
	debugLogger.Log().Msgf("Using log level: %s", loglevel)
	return &debugLogger
}
