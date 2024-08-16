package debug

import (
	"github.com/rs/zerolog"
	"github.com/snyk/go-application-framework/pkg/configuration"
)

func GetDebugLevel(config configuration.Configuration) zerolog.Level {
	loglevel := zerolog.Disabled

	if config.GetBool(configuration.DEBUG) {
		loglevel = zerolog.DebugLevel

		if loglevelString := config.GetString(configuration.LOG_LEVEL); loglevelString != "" {
			var err error
			loglevel, err = zerolog.ParseLevel(loglevelString)
			if err != nil {
				loglevel = zerolog.DebugLevel
			}
		}
	}

	return loglevel
}
