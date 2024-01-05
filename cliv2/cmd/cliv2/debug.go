package main

// !!! This import needs to be the first import, please do not change this !!!
import _ "github.com/snyk/go-application-framework/pkg/networking/fips_enable"

import (
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/configuration"
	"github.com/snyk/go-application-framework/pkg/logging"
)

func getDebugLevel(config configuration.Configuration, logger *zerolog.Logger) zerolog.Level {
	loglevel := zerolog.DebugLevel
	if loglevelString := config.GetString("snyk_log_level"); loglevelString != "" {
		var err error
		loglevel, err = zerolog.ParseLevel(loglevelString)
		if err == nil {
			logger.Log().Msgf("Setting log level to %s", loglevelString)
		} else {
			logger.Log().Msgf("%v", err)
			loglevel = zerolog.DebugLevel
		}
	}
	return loglevel
}

func initDebugLogger(config configuration.Configuration) *zerolog.Logger {
	debug := config.GetBool(configuration.DEBUG)
	if !debug {
		return &noopLogger
	} else {
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
				return strings.ToUpper(fmt.Sprintf("%s", t.UTC().Format(time.RFC3339)))
			},
		}

		scrubLogger := logging.NewScrubbingWriter(zerolog.MultiLevelWriter(consoleWriter), logging.GetScrubDictFromConfig(config))
		localLogger := zerolog.New(scrubLogger).With().Str("ext", "main").Str("separator", "-").Timestamp().Logger()
		loglevel := getDebugLevel(config, &localLogger)
		debugLogger := localLogger.Level(loglevel)
		return &debugLogger
	}
}
